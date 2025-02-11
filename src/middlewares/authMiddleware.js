const admin = require("../fb-admin/firebase-admin");

// Makes sure that only authenticated users can access certain "protected" APIs. 

exports.authenticateToken = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized: No token provided" });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);

        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Auth Error:", error.message);
        res.status(403).json({ error: "Invalid or expired token: " + error.message });
    }
};
