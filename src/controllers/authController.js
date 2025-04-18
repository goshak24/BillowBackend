const { auth } = require("../config/firebase_config");
const axios = require('axios')
const admin = require("../fb-admin/firebase-admin");
const { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } = require("firebase/auth"); 

const { db } = require("../config/firebase_config");
const { collection, addDoc, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where, setDoc } = require("firebase/firestore");
const usersCollection = collection(db, "users");

exports.createUser = async (req, res) => {
    try {
        const { email, password, name, phone } = req.body; 

        if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({ error: "Password must be at least 8 characters long, contain a number, and an uppercase letter." });
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get the ID token and refresh token
        const idToken = await user.getIdToken();
        const refreshToken = user.refreshToken;

        // Save user data to Firestore or any other database 
        const userData = {
            uid: user.uid,
            email: user.email,
            name: name,
            phone: phone,
            createdAt: new Date(), 
            budget: 250
        };

        await addDoc(usersCollection, userData);

        res.status(201).json({ 
            user: userData, 
            idToken, 
            refreshToken 
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.signUserIn = async (req, res) => { 
    try {
        const { email, password } = req.body;
        const user = await signInWithEmailAndPassword(auth, email, password);
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

exports.verifyToken = async (req, res) => {
    try {
        const token = req.header("Authorization")?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized: No token provided" }); 
        }

        const decodedToken = await admin.auth().verifyIdToken(token);

        res.status(200).json({ userId: decodedToken.uid, email: decodedToken.email });
    } catch (error) {
        res.status(403).json({ error: "Invalid or expired token: " + error.message });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        // Get Firebase API key from environment variables
        const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

        if (!FIREBASE_API_KEY) {
            return res.status(500).json({ error: "Missing Firebase API Key" });
        }

        const response = await axios.post(
            `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
            {
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }
        );

        res.status(200).json({
            idToken: response.data.id_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in,
        });
    } catch (error) {
        console.error("Token refresh failed:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to refresh token" });
    }
}

exports.getUser = async (req, res) => {
    try {
        const userId = req.user.uid; // Get the authenticated user's UID
        console.log("Authenticated User ID:", userId);

        // Query the 'users' collection to find the document where the 'uid' field matches the authenticated user's UID
        const usersCollection = collection(db, "users");
        const q = query(usersCollection, where("uid", "==", userId));
        const querySnapshot = await getDocs(q);

        // Check if any documents match the query
        if (querySnapshot.empty) {
            return res.status(404).json({ error: "User not found." });
        }

        // Get the first matching document (assuming UID is unique)
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // Return the user data
        res.status(200).json(userData);
    } catch (error) {
        console.error("Error fetching user:", error.message, error.stack);
        res.status(500).json({ error: "Failed to fetch user data." });
    }
};

exports.sendPasswordReset = async (req, res) => {
    try {
        const email = req.body.email;
        if (!email) {
            return res.status(400).json({ error: "Email is required." });
        }

        const sendEmail = await sendPasswordResetEmail(auth, email);
        res.status(200).json({ message: "Reset Password Email Sent.", sendEmail });
    } catch (error) {
        console.error("Backend Reset Error:", error);
        res.status(400).json({ error: error.message });
    }
};

exports.updateBudget = async (req, res) => {
    try {
        const budget = parseFloat(req.body.budget); 
        const uid = req.user.uid; 

        // Validate the budget value
        if (isNaN(budget) || budget < 0) {
            return res.status(400).json({ error: "Budget must be a positive number." });
        }

        // Query Firestore to find the user document by UID
        const userQuery = query(usersCollection, where("uid", "==", uid));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            return res.status(404).json({ error: "User not found." });
        }

        // Get the first matching document ID
        const userDoc = userSnapshot.docs[0];
        const userRef = doc(db, "users", userDoc.id);

        // Update the budget field in the user document
        await updateDoc(userRef, { budget: budget });

        // Return success response
        res.status(200).json({ message: "Budget updated successfully.", budget: budget });
    } catch (error) {
        console.error("Error updating budget:", error.message);
        res.status(500).json({ error: "Failed to update budget. Please try again later." });
    }
}; 

exports.updateFcmToken = async (req, res) => {
    const userId = req.user.uid;
    const { fcmToken } = req.body;
  
    if (!fcmToken) {
      return res.status(400).json({ error: 'No FCM token provided' });
    }
  
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { fcmToken }, { merge: true });
  
      res.status(200).json({ message: 'Token updated' });
    } catch (error) {
      console.error('Error updating FCM token:', error.message);
      res.status(500).json({ error: 'Failed to update FCM token' });
    }
  }; 