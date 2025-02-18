const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { axios } = require('axios')

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.labels', // Manage labels
  'https://www.googleapis.com/auth/gmail.modify', // Read and modify emails
  'https://www.googleapis.com/auth/gmail.readonly' // Read-only access (already included)
];

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret, 
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;
  
  client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH, redirectUri: 'http://localhost:3000/oauth2callback' });
  if (client.credentials) await saveCredentials(client);
  return client;
}

async function listLabels(req, res) {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.labels.list({ userId: 'me' });
    const labels = response.data.labels;

    if (!labels || labels.length === 0) return res.json({ message: 'No labels found.' });

    res.json({ labels });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching labels' });
  }
}

async function getLabelledEmails(req, res) {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    const labelId = req.params.id; // Get label ID from request
    const response = await gmail.users.labels.get({
      userId: 'me',
      id: labelId,
    });

    res.status(200).json({ label: response.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

async function createLabel(req, res) {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    const label = {
      name: req.body.name, 
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    };

    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: label,
    });

    res.status(201).json({ message: "Label created successfully", label: response.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
} 

async function deleteLabel(req, res) {
  try {
    const auth = await authorize();
    const gmail = google.gmail({ version: 'v1', auth });

    const labelId = req.params.id; 
    await gmail.users.labels.delete({
      userId: "me",
      id: labelId,
    });

    res.status(200).json({ message: "Label deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { listLabels, getLabelledEmails, createLabel, deleteLabel }; 