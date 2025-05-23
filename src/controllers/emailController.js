const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { google } = require("googleapis");
require("dotenv").config();

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

// Configuration - Set your primary redirect URI here
const PRIMARY_REDIRECT_URI = "https://f64b-86-30-169-92.ngrok-free.app/api/email/url/callback";
const LOCAL_REDIRECT_URI = "http://localhost:5000/api/email/url/callback";

async function loadSavedCredentialsIfExists() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (error) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.web || keys.installed;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });

  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize(redirectUri = PRIMARY_REDIRECT_URI) {
  let client = await loadSavedCredentialsIfExists();
  if (client) {
    return client;
  }

  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const { client_id, client_secret } = keys.web || keys.installed;

  return new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );
}

// Generate OAuth URL
const getAuthUrl = async (req, res) => {
  try {
    // Use the same redirect URI that will be used in the callback
    const redirectUri = req.query.local ? LOCAL_REDIRECT_URI : PRIMARY_REDIRECT_URI;
    const oauth2Client = await authorize(redirectUri);

    console.log("Using Redirect URI:", redirectUri);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      redirect_uri: redirectUri,
    });

    console.log("Generated Auth URL:", authUrl);
    res.json({ authUrl });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ error: "Failed to generate auth URL", details: error.message });
  }
};

// Handle OAuth Callback
const handleOAuthCallback = async (req, res) => {
  console.log("🔄 OAuth Callback triggered...");

  try {
    const { code } = req.query;
    if (!code) {
      console.error("❌ No authorization code received in callback!");
      return res.status(400).json({ error: "Authorization code is missing" });
    }

    console.log(`✅ Received OAuth code: ${code}`);

    // Determine if this is a local callback
    const isLocal = req.headers.host.includes('localhost');
    const redirectUri = isLocal ? LOCAL_REDIRECT_URI : PRIMARY_REDIRECT_URI;
    
    const oauth2Client = await authorize(redirectUri);

    console.log("🔄 Exchanging code for tokens with redirect:", redirectUri);
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });

    console.log("✅ Tokens received:", tokens);

    oauth2Client.setCredentials(tokens);
    await saveCredentials(oauth2Client);

    console.log("💾 Tokens saved successfully!");

    return res.json({ message: "Authentication successful!", tokens });
  } catch (error) {
    console.error("OAuth Callback Error:", error);
    return res.status(500).json({ 
      error: "OAuth callback failed", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// List Gmail Labels
const listLabels = async (req, res) => {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.labels.list({ userId: "me" });
    res.json({ labels: response.data.labels || [] });
  } catch (error) {
    console.error("Error listing labels:", error);
    res.status(500).json({ error: "Error fetching labels", details: error.message });
  }
};

// Get Emails from Specific Label
const getLabelledEmails = async (req, res) => {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const labelId = req.params.id;
    const response = await gmail.users.labels.get({ userId: "me", id: labelId });

    res.json({ label: response.data });
  } catch (error) {
    console.error("Error getting labelled emails:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create Gmail Label
const createLabel = async (req, res) => {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const label = {
      name: req.body.name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    };

    const response = await gmail.users.labels.create({ 
      userId: "me", 
      requestBody: label 
    });

    res.status(201).json({ 
      message: "Label created successfully", 
      label: response.data 
    });
  } catch (error) {
    console.error("Error creating label:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete Gmail Label
const deleteLabel = async (req, res) => {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: "v1", auth });

    const labelId = req.params.id;
    await gmail.users.labels.delete({ userId: "me", id: labelId });

    res.status(200).json({ message: "Label deleted successfully" });
  } catch (error) {
    console.error("Error deleting label:", error);
    res.status(500).json({ error: error.message });
  }
};

const exchangeCode = async (req, res) => {
  console.log("🔄 Direct Code Exchange triggered...");

  try {
    const { code } = req.body;
    if (!code) {
      console.error("❌ No authorization code received in request!");
      return res.status(400).json({ error: "Authorization code is missing" });
    }

    console.log(`✅ Received OAuth code: ${code}`);

    const oauth2Client = await authorize(PRIMARY_REDIRECT_URI);
    
    console.log("🔄 Exchanging code for tokens with redirect:", PRIMARY_REDIRECT_URI);
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: PRIMARY_REDIRECT_URI,
    });

    console.log("✅ Tokens received:", tokens);

    oauth2Client.setCredentials(tokens);
    await saveCredentials(oauth2Client);

    console.log("💾 Tokens saved successfully!");

    return res.json({ message: "Authentication successful!", tokens });
  } catch (error) {
    console.error("Code Exchange Error:", error);
    return res.status(500).json({ 
      error: "Code exchange failed", 
      details: error.message 
    });
  }
};

// Disconnect Gmail (Delete Token)
const disconnectGmail = async (req, res) => {
  try {
    await fs.unlink(TOKEN_PATH);
    res.status(200).json({ message: "Gmail account disconnected." });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listLabels,
  getLabelledEmails,
  createLabel,
  deleteLabel,
  disconnectGmail,
  getAuthUrl,
  handleOAuthCallback,
  exchangeCode
};