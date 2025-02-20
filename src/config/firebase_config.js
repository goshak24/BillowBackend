const { initializeApp } = require("firebase/app"); 
const { getFirestore } = require("firebase/firestore");
const { getAuth } = require("firebase/auth");
// const { getMessaging } = require('firebase/messaging'); 

const firebaseConfig = {
  apiKey: "AIzaSyB_vy0NkESCmMFIxTj9_aYpOFcZ6AiQp2o",
  authDomain: "billowback.firebaseapp.com",
  projectId: "billowback",
  storageBucket: "billowback.firebasestorage.app",
  messagingSenderId: "154617010209",
  appId: "1:154617010209:web:b5d98538ece9b2e3922b60"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app); 
const auth = getAuth(app); 
// const messaging = getMessaging(app); 

module.exports = { db, auth } 