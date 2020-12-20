var AWS = require("aws-sdk");

AWS.config.update({
    region: "us-east-2",
    endpoint: "https://dynamodb.us-east-2.amazonaws.com"
});

exports.AWS = AWS;
