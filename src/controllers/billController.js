const { db } = require("../config/firebase_config")
const { collection, addDoc, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where } = require("firebase/firestore");
const billsCollection = collection(db, "bills");

// Upload single bill to firestore
exports.uploadBill = async (req, res) => { 
    try {
        const { fileUrl, category, payDate, amount, vendor } = req.body;
        const userId = req.user.uid; 

        const docRef = await addDoc(billsCollection, {
            userId: userId, 
            category: category,
            payDate: payDate, 
            amount: amount, 
            vendor: vendor, 
            fileUrl: fileUrl || null, // Physical bill cloud URL 
            paid: false, 
            saved: false, 
            createdAt: new Date() 
        })

        res.status(201).json({ id: docRef.id, ...billData });
    } catch (error) {
        res.status(500).json({ error: "Failed to upload bill: " + error.message });
    } 
} 

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
        res.status(500).json({ error: "Failed to upload bill: " + error.message });
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
        const bills = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })); 

        res.status(200).json(bills); 
    } catch (error) {
        res.status(500).json({ error: "Failed to upload bill: " + error.message });
    } 
} 

// Retrieve bills using a search term (e.g., vendor, amount or category)
exports.getBillsBySearch = async (req, res) => {
    try {} catch (error) {}
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

exports.markBillAsPaid = async (req, res) => {
    try {
        const { billId } = req.params; 
        const { paid } = req.body; 

        await updateDoc(doc(billsCollection, billId), { paid }); 

        res.status(200).json({ message: `Bill marked as ${paid ? 'paid' : 'unpaid'}` }); 
    } catch (error) {
        res.status(500).json({ error: error.message }); 
    } 
}

// Highlight a bill by billId (e.g., if its an important bill) 
exports.highlightBill = async (req, res) => {
    try {
        const { billId } = req.params; 
        const { saved } = req.body; 

        await updateDoc(doc(billsCollection, billId), { saved }); 

        res.status(200).json({ message: `Bill has been ${saved ? 'saved' : 'unsaved'}` }) 
    } catch (error) {
        res.status(500).json({ error: error.message })
    } 
} 

exports.deleteBill = async (req, res) => {
    try {
        const { billId } = req.params; 
        await deleteDoc(doc(billsCollection, billId)); 
        
        res.status(200).json({ message: 'Bill deleted successfully' }); 
    } catch (error) {
        res.status(500).json({ error: error.message })
    } 
} 

