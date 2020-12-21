// Importing dependencies
const express = require("express");
const https = require("https");
const http = require("http");
const compression = require("compression");
const helmet = require("helmet");
const request = require("request");
const axios = require("axios");
const path = require("path");
const giftsCRUD = require("./GiftsCRUD");
const awsconfig = require('./awsconfig');
const environment_vars = require('./envs');
const process = require("process");
var EventEmitter = require('events').EventEmitter;

const GIFTSTABLE = "gifts";
var AWS = awsconfig.AWS;

var docClient = new AWS.DynamoDB.DocumentClient();

async function getGiftListAsync(user_id) {
    try {
        const params = {
            TableName: GIFTSTABLE,
            KeyConditionExpression: "user_id = :user_id",
            ExpressionAttributeValues: {
                 ":user_id": user_id
            }
        };
    
        const res = await docClient.query(params).promise();
        return res.Items[0];
    }
    catch(e) {
        console.log("Unable to retrieve gift list from server");
        throw new Error(e);
    }
}

async function getEtsyGiftInfo(listing_id) {
    let api_key = "?api_key=" + environment_vars.EtsyAPISecrets.keystring;
    var listing_url = environment_vars.EtsyAPISecrets.listings_api_server + listing_id;

    var etsyGift = {};

    etsyGift.link_url = "";
    etsyGift.user_id = "";
    etsyGift.id = 0;
    etsyGift.server = "etsy.com";

    const urls = [(listing_url + api_key), (listing_url + "/images" + api_key)];

    try {
        const [res1, res2] = await axios.all([
            axios.get(urls[0]),
            axios.get(urls[1])
        ]);

        let etsyInfoRes = res1.data.results[0];
        let etsyImageRes = res2.data.results[0];

        etsyGift.name = etsyInfoRes.title;
        etsyGift.price = parseFloat(etsyInfoRes.price);
        etsyGift.photo_url = etsyImageRes.url_fullxfull;

        return etsyGift;
    }
    catch(e) {
        console.log("Etsy gift info retrieval failed");
        throw new Error(e);
    }

}

function addGiftToList(gift) {
    const updateExpression = "SET gift" + gift.id + " = :vals";
    const conditionExpression = "attribute_not_exists(gift" + gift.id + ")";
    const params = {
        Key: {user_id: gift.user_id},
        TableName: GIFTSTABLE,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
            ":vals": {
                user_id: gift.user_id,
                id: gift.id,
                name: gift.name,
                price: gift.price,
                link_url: gift.link_url,
                photo_url: gift.photo_url,
                server: gift.server
            }
        },
        conditionExpression: conditionExpression
    }

    docClient.update(params, function(err, data) {
        if(err) {
            console.error(err);
        }
        else {
            // console.log(JSON.stringify(data, null, 2));
        }
    });
}

function deleteGiftFromList(gift) {
    const setQuery = "REMOVE gift" + gift.id;
    const params = {
        Key: {user_id: gift.user_id},
        TableName: GIFTSTABLE,
        UpdateExpression: setQuery,        
    }

    docClient.update(params, function(err, data) {
        if(err) {
            console.error(err);
        }
        else {
            console.log("Item added!");
            //console.log(JSON.stringify(data, null, 2));
        }
    });
}


// Starting Express app
const app = express();
app.use(compression());
app.use(helmet());

const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Accept-Language, Content-Language");
    next();
});

// // Set the base path to the kringle dist folder
// app.use(express.static(path.join(__dirname, '../dist/kringle')));

// /////////// NODE REQUESTS ////////////

// // Any routes will be redirected to the angular app
// app.get('/', function(req, res) {
//     res.sendFile(path.join(__dirname, 'dist/kringle/index.html'));
// });

app.get('/getGiftListForUser/:userId', async function(req, res) {

    try {
        let user_id = req.params["userId"];
        const Item = await getGiftListAsync(user_id);
    
        var gift_list = [];
    
        // filter only the gifts to pass back
        var gift_keys = Object.keys(Item).filter(k => {
            return k.substring(0, 4) == "gift";
        });
    
        gift_keys.sort();
    
        gift_keys.forEach(key => {
            gift_list.push(Item[key]);
        })
      
        let response = {
            user_id: user_id,
            gifts: gift_list.sort()
        }
        res.json(response);
    }
    catch(e) {
        console.log("Error getting gift list");
        throw new Error(e);
    }
    
});

app.all("/getEtsyInfo/:listing_id/", async function(req, res, next) {
    try {
        let listing_id = req.params['listing_id'];
        let user_id = req.params['user_id'];
    
        let etsyGift = await getEtsyGiftInfo(listing_id);
    
        res.json(etsyGift);
    }
    catch(e) {
        console.log("Unable to get Etsy info");
        throw new Error(e);
    }
});


app.all("/getEtsyInfo/:listing_id/images", function(req, res, next) {

    try {
        let listing_id = req.params['listing_id'];
        let api_key = "?api_key=" + environment_vars.EtsyAPISecrets.keystring;
        var listing_url = environment_vars.EtsyAPISecrets.listings_api_server + listing_id;
        
        const options = {
            url: listing_url + "/images" + api_key
        };
    
        let emitter = new EventEmitter();
        request(options, function(error, response, body) {
            emitter.data = JSON.parse(body);
            emitter.emit('udpate');
        });
    
        emitter.on('update', function() {
            res.json(emitter.data.results[0]);
        });
    }
    catch(e) {
        console.log("Error getting Etsy images");
        throw new Error(e);
    }
  
});

app.post('/addGiftToList', function(req, res) {

    try {
        const gift = req.body;
        const response = addGiftToList(gift);
        res.send("gift added")
    }
    catch(e) {
        console.log("Add gift to list failed");
        throw new Error(e);
    }
    
})


app.post('/deleteGiftFromList', function(req, res) {
    try {
        const gift = req.body;
        const response = deleteGiftFromList(gift);
        res.send("gift removed")
    }
    catch(e) {
        console.log("Failure deleting gift from list");
        throw new Error(e);
    }
    
});

// starting server on port 8080
const port = process.env.port || 8080;
app.listen(port, () => {
    console.log("Server started!");
    console.log("on port " + port);
})