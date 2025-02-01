const { db } = require("../config/firebase_config")
const { collection, addDoc, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where } = require("firebase/firestore");
const billsCollection = collection(db, "bills");

