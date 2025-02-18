const { auth } = require("../config/firebase_config"); 
const { axios } = require('axios')
const admin = require("../fb-admin/firebase-admin");
const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");

exports.createUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Password Validation 
        if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({ error: "Password must be at least 8 characters long, contain a number, and an uppercase letter." });
        }
        
        const user = await createUserWithEmailAndPassword(auth, email, password);
        res.status(201).json(user);
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

        const response = await axios.post(
            `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
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
        res.status(500).json({ error: "Failed to refresh token" });
    }
}; 