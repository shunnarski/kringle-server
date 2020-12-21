
const awsconfig = require('./awsconfig')
var AWS = awsconfig.AWS;

var docClient = new AWS.DynamoDB.DocumentClient();

async function getGiftListAsync(user_id) {

    try {
        const params = {
            TableName: "gifts",
            KeyConditionExpression: "user_id = :user_id",
            ExpressionAttributeValues: {
                ":user_id": user_id
            }
        };

        const res = await docClient.query(params).promise();
        return res.Items[0];
    }
    catch (e) {
        console.log("There was error retrieving gifts");
        throw new Error(e);
    }
        
        
}



// exports.handler = async(event, context) => {
//     try {
//         const data = await getGiftListAsync(user_id);
//     } catch(err) {
//         return {error: err}
//     }
// }