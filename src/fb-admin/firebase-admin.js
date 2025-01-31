const admin = require("firebase-admin");

// Service account key file 
const serviceAccount = require("../fb-admin/fb-service-acc-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;