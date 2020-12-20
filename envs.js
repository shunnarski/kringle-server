const process = require("process");
const EtsyAPISecrets = {
    appName: "Kringle",
    keystring: process.env.ETSY_KEYSTRING,
    shared_secret: process.env.ETSY_SECRET,
    listings_api_server: process.env.ETSY_API_SERVER
}

exports.EtsyAPISecrets = EtsyAPISecrets;