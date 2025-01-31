const { auth } = require("../config/firebase_config")
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