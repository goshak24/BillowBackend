const { initializeApp } = require("firebase/app"); 
const { getFirestore } = require("firebase/firestore");
const { getAuth } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyD8UuZ8gdFpyBB3NozAJa-G26CiYZ8QziE",
  authDomain: "billowbackend.firebaseapp.com",
  projectId: "billowbackend",
  storageBucket: "billowbackend.firebasestorage.app",
  messagingSenderId: "632447774254",
  appId: "1:632447774254:web:92e23bc0ea2ef9d91139bf",
  measurementId: "G-C2T4N55DEW"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app); 
const auth = getAuth(app); 

module.exports = { db, auth } 