// Express Server and API Endpoint Controller for Vercel Serverless hosting
// Current Date Reference: 2026-07-02

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' (for local testing/standalone server runs)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize DB Connection
let dbInitialized = false;
db.initDb().then(() => {
    dbInitialized = true;
}).catch(err => {
    console.error("Critical database initialisation error:", err);
});

// Middleware to ensure DB is initialized before handling requests
app.use((req, res, next) => {
    if (dbInitialized) {
        next();
    } else {
        res.status(503).json({ error: "Database initialization in progress. Please try again shortly." });
    }
});

// ================= API REST ROUTES =================

function computeStatus(expiryDate) {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const exp = new Date(expiryDate);
    const expDate = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    
    if (expDate < todayDate) {
        return "expired";
    }
    
    const diffTime = expDate - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
        return "expiring";
    }
    return "active";
}

// AUTHENTICATION LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }
        
        // 1. Check Admin Credentials (customizable via env variables for production security)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@ironnation.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (email.toLowerCase() === adminEmail.toLowerCase() && password === adminPassword) {
            return res.json({
                success: true,
                role: 'admin',
                user: {
                    name: 'Gym Manager',
                    email: adminEmail
                }
            });
        }
        
        // 2. Check Customer Credentials (Password is Member ID)
        const members = await db.getMembers();
        const member = members.find(m => m.email.toLowerCase() === email.toLowerCase());
        
        if (member && member.id === password) {
            member.status = computeStatus(member.expiryDate);
            return res.json({
                success: true,
                role: 'customer',
                user: member
            });
        }
        
        // 3. Invalid Credentials
        return res.status(401).json({ error: "Invalid email address or password/Member ID." });
    } catch (e) {
        res.status(500).json({ error: "Authentication system error: " + e.message });
    }
});

// MEMBERS DIRECTORY ROUTES
app.get('/api/members', async (req, res) => {
    try {
        const members = await db.getMembers();
        const updatedMembers = members.map(m => {
            m.status = computeStatus(m.expiryDate);
            return m;
        });
        res.json(updatedMembers);
    } catch (e) {
        res.status(500).json({ error: "Failed to retrieve members: " + e.message });
    }
});

app.post('/api/members', async (req, res) => {
    try {
        const member = req.body;
        if (!member.id || !member.name || !member.email) {
            return res.status(400).json({ error: "Missing required member fields (id, name, email)." });
        }
        
        member.status = computeStatus(member.expiryDate);
        
        const created = await db.addMember(member);
        res.status(201).json(created);
    } catch (e) {
        res.status(500).json({ error: "Failed to create member: " + e.message });
    }
});

app.put('/api/members/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const fields = req.body;
        
        if (fields.expiryDate) {
            fields.status = computeStatus(fields.expiryDate);
        }
        
        const updated = await db.updateMember(id, fields);
        if (!updated) {
            return res.status(404).json({ error: `Member with ID ${id} not found.` });
        }
        updated.status = computeStatus(updated.expiryDate);
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update member: " + e.message });
    }
});

app.delete('/api/members/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.deleteMember(id);
        res.json({ success: true, message: `Member ${id} successfully removed.` });
    } catch (e) {
        res.status(500).json({ error: "Failed to remove member: " + e.message });
    }
});

// MEMBERSHIP PLANS ROUTES
app.get('/api/plans', async (req, res) => {
    try {
        const plans = await db.getPlans();
        res.json(plans);
    } catch (e) {
        res.status(500).json({ error: "Failed to retrieve membership plans: " + e.message });
    }
});

app.post('/api/plans', async (req, res) => {
    try {
        const plan = req.body;
        if (!plan.id || !plan.name || plan.price === undefined) {
            return res.status(400).json({ error: "Missing required plan fields (id, name, price)." });
        }
        
        const plans = await db.getPlans();
        const existingIdx = plans.findIndex(p => p.id === plan.id);
        
        let saved;
        if (existingIdx !== -1) {
            saved = await db.updatePlan(plan.id, plan);
        } else {
            saved = await db.addPlan(plan);
        }
        
        res.json(saved);
    } catch (e) {
        res.status(500).json({ error: "Failed to save plan: " + e.message });
    }
});

app.delete('/api/plans/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await db.deletePlan(id);
        res.json({ success: true, message: `Plan ${id} successfully deleted.` });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete plan: " + e.message });
    }
});

// ATTENDANCE LOGS ROUTES
app.get('/api/checkins', async (req, res) => {
    try {
        const checkins = await db.getCheckins();
        res.json(checkins);
    } catch (e) {
        res.status(500).json({ error: "Failed to retrieve checkin logs: " + e.message });
    }
});

app.post('/api/checkins', async (req, res) => {
    try {
        const checkin = req.body;
        if (!checkin.id || !checkin.memberId || !checkin.memberName) {
            return res.status(400).json({ error: "Missing required checkin fields (id, memberId, memberName)." });
        }
        
        // Prevent double check-in on the same day
        const dateStr = checkin.timestamp ? checkin.timestamp.substring(0, 10) : "";
        if (dateStr) {
            const checkins = await db.getCheckins();
            const alreadyCheckedIn = checkins.some(c => c.memberId === checkin.memberId && c.timestamp.startsWith(dateStr));
            if (alreadyCheckedIn) {
                return res.status(409).json({ error: "Member has already checked in today." });
            }
        }
        
        const created = await db.addCheckin(checkin);
        res.status(201).json(created);
    } catch (e) {
        res.status(500).json({ error: "Failed to record checkin: " + e.message });
    }
});

app.post('/api/checkins/clear', async (req, res) => {
    try {
        await db.clearCheckins();
        res.json({ success: true, message: "Attendance logs cleared successfully." });
    } catch (e) {
        res.status(500).json({ error: "Failed to clear attendance history: " + e.message });
    }
});

// Root HTML routing fallback (Serves static app.html/index.html)
app.get('*', (req, res, next) => {
    // Let express.static handle standard files, else serve index.html
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Conditionally launch local listener if not run serverless in Vercel
if (!process.env.VERCEL) {
    const initialPort = parseInt(process.env.PORT || 3000, 10);
    
    function startServer(port) {
        const server = app.listen(port, () => {
            console.log(`=========================================`);
            console.log(`Iron Nation Gym Full-Stack Server running`);
            console.log(`Target: http://localhost:${port}`);
            console.log(`Mode:   ${process.env.MONGODB_URI ? 'Cloud MongoDB Atlas' : 'Local JSON file fallback'}`);
            console.log(`=========================================`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is already in use. Retrying on port ${port + 1}...`);
                startServer(port + 1);
            } else {
                console.error("Server startup error:", err);
            }
        });
    }
    
    startServer(initialPort);
}

// Export for serverless Vercel function wrapping
module.exports = app;
