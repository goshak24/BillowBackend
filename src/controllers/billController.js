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

        const { category, payDate, amount, vendor, fileUrl, reoccuring, type, color } = req.body;

        // Validate required fields
        if (!category || !amount || !vendor || !type) {
            return res.status(400).json({ error: "Missing required fields" }); 
        }

        // Validate type (must be either 'bill' or 'expense')
        if (!["bill", "expense"].includes(type)) {
            return res.status(400).json({ error: "Invalid type. Must be 'bill' or 'expense'." }); 
        }

        // Handle date properly regardless of input format
        let formattedPayDate = null;
        if (payDate) {
            const dateObj = new Date(payDate);
            if (!isNaN(dateObj)) {
                formattedPayDate = dateObj.toLocaleString('default', { month: 'short', day: 'numeric' });
            }
        }

        // Create the bill/expense data object
        let billOrExpenseData = {
            userId,
            category,
            amount: parseFloat(amount),
            vendor,
            color: color || null, 
            type, 
            paid: false,
            saved: false,
            createdAt: new Date(),
            fileUrl: fileUrl || null,
            reoccuring: reoccuring || false,
            payDate: formattedPayDate, // Use our properly formatted date
            paidDate: null // Initialize paidDate as null
        }; 

        // Add a new document to the "bills" collection
        const docRef = await addDoc(billsCollection, billOrExpenseData);

        // Return the document ID and data
        res.status(201).json({ id: docRef.id, ...billOrExpenseData });
    } catch (error) {
        console.error("Upload Bill/Expense Error:", error.message);
        res.status(500).json({ error: "Failed to upload bill/expense: " + error.message });
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
        const { category, vendor, payDate, createdAt, amount, paid, paidDate, paidDateFrom, paidDateTo } = req.query;

        let q = query(billsCollection, where("userId", "==", userId));

        if (category) q = query(q, where("category", "==", category));
        if (vendor) q = query(q, where("vendor", "==", vendor));
        if (payDate) q = query(q, where("payDate", "==", payDate));
        if (createdAt) q = query(q, where("createdAt", "==", new Date(createdAt)));
        if (amount) q = query(q, where("amount", "==", parseFloat(amount)));
        if (paid !== undefined) q = query(q, where("paid", "==", paid === 'true'));
        
        // Get bills - we'll filter by date range in JavaScript since Firestore
        // doesn't easily support range queries on multiple fields
        const querySnapshot = await getDocs(q);
        let bills = [];
        
        querySnapshot.forEach((doc) => {
            bills.push({ id: doc.id, ...doc.data() });
        });
        
        // If paidDate filters are provided, apply them in JavaScript
        if (paidDateFrom || paidDateTo) {
            const fromDate = paidDateFrom ? new Date(paidDateFrom) : new Date(0); // 0 timestamp for earliest date
            const toDate = paidDateTo ? new Date(paidDateTo) : new Date(); // Current date if not specified
            
            bills = bills.filter(bill => {
                if (!bill.paidDate) return false;
                
                const billPaidDate = bill.paidDate instanceof Date ? 
                    bill.paidDate : 
                    new Date(bill.paidDate);
                    
                return billPaidDate >= fromDate && billPaidDate <= toDate;
            });
        } else if (paidDate) {
            // Exact paidDate match
            const exactDate = new Date(paidDate);
            bills = bills.filter(bill => {
                if (!bill.paidDate) return false;
                
                const billPaidDate = bill.paidDate instanceof Date ? 
                    bill.paidDate : 
                    new Date(bill.paidDate);
                
                return billPaidDate.toDateString() === exactDate.toDateString();
            });
        }

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
        
        // If marking as paid, add a paidDate
        // If marking as unpaid, remove the paidDate
        const updateData = { 
            paid: newPaid
        };
        
        if (newPaid) {
            // Add paidDate when marking as paid
            updateData.paidDate = new Date();
        } else {
            // Remove paidDate when marking as unpaid
            updateData.paidDate = null;
        }

        await updateDoc(doc(billsCollection, billId), updateData); 

        res.status(200).json({ 
            message: `Bill has been ${newPaid ? "paid" : "unpaid"}`,
            paidDate: newPaid ? updateData.paidDate : null
        });
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