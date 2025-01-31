const admin = require("../config/firebaseAdmin");

// Makes sure that only authenticated users can access certain "protected" APIs. 

exports.authenticateToken = async (req, res, next) => {
    try {
        // Get token from the "Authorization" header
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized: No token provided" });
        }

        // Verify the token with Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Attach user data to request
        req.user = decodedToken;
        
        next(); // Allow request to continue
    } catch (error) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
}; 