const { db } = require("../config/firebase_config");
const { collection, addDoc, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where } = require("firebase/firestore");
const billsCollection = collection(db, "bills");

// Upload single bill to firestore
exports.uploadBill = async (req, res) => {
    try {
        const userId = req.user?.uid;

        if (!userId) {
            return res.status(403).json({ error: "Unauthorized: Missing user ID" });
        }

        const { category, payDate, amount, vendor, fileUrl } = req.body;

        // Validate required fields
        if (!category || !payDate || !amount || !vendor) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        let billData = {
            userId,
            category, 
            payDate: new Date(payDate).toLocaleString('default', { month: 'short', day: 'numeric' }), 
            amount: parseFloat(amount),
            vendor,
            fileUrl: fileUrl || null,
            paid: false,
            saved: false,
            createdAt: new Date(),
        };

        // Add a new document to the "bills" collection
        const docRef = await addDoc(billsCollection, billData);

        // Return the document ID and data
        res.status(201).json({ id: docRef.id, ...billData });
    } catch (error) {
        console.error("Upload Bill Error:", error.message);
        res.status(500).json({ error: "Failed to upload bill: " + error.message });
    }
};

// Fetch a user's bill by its ID 
exports.getBillById = async (req, res) => {
    try {
        const { billId } = req.params;
        const billDoc = await getDoc(doc(billsCollection, billId));

        if (!billDoc.exists()) {
            return res.status(404).json({ error: "Bill not found" });
        }

        res.status(200).json({ id: billDoc.id, ...billDoc.data() });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve bill: " + error.message });
    }
}

// Fetch a user's bills by field 
exports.getBillsByField = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { category, vendor, payDate, createdAt, amount, paid } = req.query;


        let q = query(billsCollection, where("userId", "==", userId));

        if (category) q = query(q, where("category", "==", category));
        if (vendor) q = query(q, where("vendor", "==", vendor));
        if (payDate) q = query(q, where("payDate", "==", payDate));
        if (createdAt) q = query(q, where("createdAt", "==", new Date(createdAt)));
        if (amount) q = query(q, where("amount", "==", parseFloat(amount)));
        if (paid) q = query(q, where("paid", "==", true));

        const querySnapshot = await getDocs(q);
        const bills = [];
        querySnapshot.forEach((doc) => {
            bills.push({ id: doc.id, ...doc.data() });
        });

        if (bills.length === 0) {
            console.log("No bills found matching the query.");
        }

        res.status(200).json(bills);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// TEST: Retrieve bills using a search term (e.g., name) 
exports.getBillsBySearch = async (req, res) => {
    try { 
        const { userId } = req.user.uid; 
        const { billName } = req.query; 

        const billDoc = await getDoc(doc(billsCollection, billName));

        if (!billDoc.exists()) {
            return res.status(404).json({ error: "Bill not found" });
        }

        res.status(200).json({ id: billDoc.id, ...billDoc.data() });
     } catch (error) {

    }
}

// Update a bill's details in firestore via its billId 
exports.updateBill = async (req, res) => {
    try {
        const { billId } = req.params;
        const updates = req.body;

        await updateDoc(doc(billsCollection, billId), updates);
        res.status(200).json({ message: 'Bill successfully updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Mark a bill as Paid via its billId 
exports.markBillAsPaid = async (req, res) => {
    try {
        const { billId } = req.params;

        // Fetch current 'paid' data
        const billRef = doc(billsCollection, billId); 
        const billSnap = await getDoc(billRef); 

        if (!billSnap.exists()) {
            return res.status(404).json({ message: "Bill not found" });
        }

        const currentPaid = billSnap.data().paid;
        const newPaid = !currentPaid;

        await updateDoc(doc(billsCollection, billId), { paid: newPaid }); 

        res.status(200).json({ message: `Bill has been ${newPaid ? "paid" : "unpaid"}` });
    } catch (error) {
        res.status(500).json({ error: error.message }); 
    }
}

// Highlight a bill by billId (e.g., if its an important bill) 
exports.highlightBill = async (req, res) => {
    try {
        const { billId } = req.params;

        // Fetch current 'saved' data
        const billRef = doc(billsCollection, billId);
        const billSnap = await getDoc(billRef);

        if (!billSnap.exists()) {
            return res.status(404).json({ message: "Bill not found" });
        }

        const currentSaved = billSnap.data().saved;
        const newSaved = !currentSaved;

        await updateDoc(billRef, { saved: newSaved });

        res.status(200).json({ message: `Bill has been ${newSaved ? "saved" : "unsaved"}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Remove a bill from firestore storage 
exports.deleteBill = async (req, res) => {
    try {
        const { billId } = req.params;
        await deleteDoc(doc(billsCollection, billId));

        res.status(200).json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
} 