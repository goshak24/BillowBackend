const admin = require("firebase-admin");
require('dotenv').config();

// Function to ensure private key is properly formatted
const formatPrivateKey = (key) => {
  // Replace all variations of escaped newlines with actual newlines
  const formattedKey = key
    .replace(/\\n/g, '\n')
    .replace(/\\\\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\\\r\\\\n/g, '\n');
  
  // Ensure key starts and ends with the appropriate markers
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
  }
  
  return formattedKey;
};

// Use environment variables instead of service account key file
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: formatPrivateKey(process.env.PRIVATE_KEY),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;