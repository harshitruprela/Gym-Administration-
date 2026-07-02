// Database Connection and Management Layer
// Supports MongoDB Atlas with seamless local JSON file fallback for offline/local testing.

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Seed Data
const defaultPlans = [
    {
        id: "plan-standard",
        name: "Standard Tier",
        price: 499,
        duration: 1,
        features: ["Access to gym floor", "Locker room access", "1 Fitness evaluation"]
    },
    {
        id: "plan-premium",
        name: "Premium VIP",
        price: 999,
        duration: 1,
        features: ["24/7 Gym access", "Group fitness classes", "Pool & Sauna access", "Towel service"]
    },
    {
        id: "plan-annual",
        name: "Annual Elite",
        price: 9999,
        duration: 12,
        features: ["All Premium perks", "5 Personal training sessions", "10% Juice Bar discount", "2 Guest passes per month"]
    }
];

const defaultMembers = [];

const defaultCheckins = [];

// Determine Mode
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGOHQ_URL;
const isMongoDB = !!MONGODB_URI;

let mongoClient = null;
let mongoDb = null;

const localDbPath = path.join(__dirname, '..', 'local_db.json');

// Local File Helper
function readLocalDb() {
    try {
        if (!fs.existsSync(localDbPath)) {
            const data = { members: defaultMembers, plans: defaultPlans, checkins: defaultCheckins };
            fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
            return data;
        }
        const raw = fs.readFileSync(localDbPath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error("Local Database Read Error, returning defaults", e);
        return { members: defaultMembers, plans: defaultPlans, checkins: defaultCheckins };
    }
}

function writeLocalDb(data) {
    try {
        fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("Local Database Write Error", e);
        return false;
    }
}

// Database Connection Orchestrator
async function initDb() {
    if (isMongoDB) {
        try {
            console.log("Connecting to Cloud MongoDB Atlas...");
            mongoClient = new MongoClient(MONGODB_URI);
            await mongoClient.connect();
            mongoDb = mongoClient.db('ironnation');
            
            // Check & Seed collections
            const membersColl = mongoDb.collection('members');
            const plansColl = mongoDb.collection('plans');
            const checkinsColl = mongoDb.collection('checkins');
            
            const membersCount = await membersColl.countDocuments();
            if (membersCount === 0) {
                await membersColl.insertMany(defaultMembers);
                console.log("Seeded default members in MongoDB.");
            }
            
            const plansCount = await plansColl.countDocuments();
            if (plansCount === 0) {
                await plansColl.insertMany(defaultPlans);
                console.log("Seeded default membership plans in MongoDB.");
            }
            
            const checkinsCount = await checkinsColl.countDocuments();
            if (checkinsCount === 0) {
                await checkinsColl.insertMany(defaultCheckins);
                console.log("Seeded default checkin logs in MongoDB.");
            }
            
            console.log("MongoDB connection established and seeded successfully!");
        } catch (e) {
            console.error("MongoDB Connection Failed! Falling back to Local JSON database.", e);
        }
    } else {
        console.log("No MONGODB_URI environment variable detected. Running in Local JSON File Database mode.");
        readLocalDb(); // Ensures file exists
    }
}

// MEMBER CRUD OPERATIONS
async function getMembers() {
    if (mongoDb && isMongoDB) {
        return await mongoDb.collection('members').find({}).toArray();
    } else {
        return readLocalDb().members;
    }
}

async function addMember(member) {
    if (mongoDb && isMongoDB) {
        await mongoDb.collection('members').insertOne(member);
        return member;
    } else {
        const db = readLocalDb();
        db.members.push(member);
        writeLocalDb(db);
        return member;
    }
}

async function updateMember(id, updatedFields) {
    if (mongoDb && isMongoDB) {
        // Exclude _id if present in fields
        const { _id, ...fields } = updatedFields;
        await mongoDb.collection('members').updateOne({ id: id }, { $set: fields });
        return { id, ...fields };
    } else {
        const db = readLocalDb();
        const idx = db.members.findIndex(m => m.id === id);
        if (idx !== -1) {
            db.members[idx] = { ...db.members[idx], ...updatedFields };
            writeLocalDb(db);
            return db.members[idx];
        }
        return null;
    }
}

async function deleteMember(id) {
    if (mongoDb && isMongoDB) {
        await mongoDb.collection('members').deleteOne({ id: id });
        await mongoDb.collection('checkins').deleteMany({ memberId: id });
        return true;
    } else {
        const db = readLocalDb();
        db.members = db.members.filter(m => m.id !== id);
        db.checkins = db.checkins.filter(c => c.memberId !== id);
        writeLocalDb(db);
        return true;
    }
}

// MEMBERSHIP PLANS CRUD
async function getPlans() {
    if (mongoDb && isMongoDB) {
        return await mongoDb.collection('plans').find({}).toArray();
    } else {
        return readLocalDb().plans;
    }
}

async function addPlan(plan) {
    if (mongoDb && isMongoDB) {
        await mongoDb.collection('plans').insertOne(plan);
        return plan;
    } else {
        const db = readLocalDb();
        db.plans.push(plan);
        writeLocalDb(db);
        return plan;
    }
}

async function updatePlan(id, updatedFields) {
    if (mongoDb && isMongoDB) {
        const { _id, ...fields } = updatedFields;
        await mongoDb.collection('plans').updateOne({ id: id }, { $set: fields });
        return { id, ...fields };
    } else {
        const db = readLocalDb();
        const idx = db.plans.findIndex(p => p.id === id);
        if (idx !== -1) {
            db.plans[idx] = { ...db.plans[idx], ...updatedFields };
            writeLocalDb(db);
            return db.plans[idx];
        }
        return null;
    }
}

async function deletePlan(id) {
    if (mongoDb && isMongoDB) {
        await mongoDb.collection('plans').deleteOne({ id: id });
        return true;
    } else {
        const db = readLocalDb();
        db.plans = db.plans.filter(p => p.id !== id);
        writeLocalDb(db);
        return true;
    }
}

// CHECKIN ATTENDANCE LOGS
async function getCheckins() {
    if (mongoDb && isMongoDB) {
        return await mongoDb.collection('checkins').find({}).sort({ timestamp: -1 }).toArray();
    } else {
        return readLocalDb().checkins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

async function addCheckin(checkin) {
    if (mongoDb && isMongoDB) {
        await mongoDb.collection('checkins').insertOne(checkin);
        // Increment member checkin counter and streak
        await mongoDb.collection('members').updateOne(
            { id: checkin.memberId },
            { $inc: { streak: 1, checkinCount: 1 } }
        );
        return checkin;
    } else {
        const db = readLocalDb();
        db.checkins.unshift(checkin);
        const memberIdx = db.members.findIndex(m => m.id === checkin.memberId);
        if (memberIdx !== -1) {
            db.members[memberIdx].streak = (db.members[memberIdx].streak || 0) + 1;
            db.members[memberIdx].checkinCount = (db.members[memberIdx].checkinCount || 0) + 1;
        }
        writeLocalDb(db);
        return checkin;
    }
}

async function clearCheckins() {
    if (mongoDb && isMongoDB) {
        await mongoDb.collection('checkins').deleteMany({});
        return true;
    } else {
        const db = readLocalDb();
        db.checkins = [];
        writeLocalDb(db);
        return true;
    }
}

module.exports = {
    initDb,
    getMembers,
    addMember,
    updateMember,
    deleteMember,
    getPlans,
    addPlan,
    updatePlan,
    deletePlan,
    getCheckins,
    addCheckin,
    clearCheckins
};
