/**
 * Migration Script: Add serialNo field to existing members
 * 
 * Run locally ONCE to backfill serialNo for existing MongoDB members.
 * Safe to run multiple times — skips members that already have a serialNo.
 * Does NOT delete or modify any other field.
 * 
 * Usage:
 *   set MONGODB_URI=mongodb+srv://...
 *   node scripts/migrate_add_serial_no.js
 */

const { MongoClient } = require('mongodb');

async function migrate() {
    const uri = process.env.MONGODB_URI || process.env.MONGOHQ_URL;
    if (!uri) {
        console.error('ERROR: MONGODB_URI environment variable is not set.');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas.');

        const db = client.db('ironnation');
        const collection = db.collection('members');

        // Fetch all members that do NOT have serialNo yet
        const members = await collection.find({ serialNo: { $exists: false } }).toArray();

        if (members.length === 0) {
            console.log('All members already have a Serial No. -- nothing to migrate.');
            return;
        }

        // Get the current max serialNo to determine where to start numbering
        const withSerial = await collection.find({ serialNo: { $exists: true } }).toArray();
        let startIndex = withSerial.length + 1;

        console.log(`Found ${members.length} member(s) without Serial No. Assigning starting from ${startIndex}...`);

        for (const member of members) {
            const sn = String(startIndex).padStart(3, '0');
            await collection.updateOne(
                { _id: member._id },
                { $set: { serialNo: sn } }
            );
            console.log(`  -> ${member.name} (${member.id}) assigned Serial No.: ${sn}`);
            startIndex++;
        }

        console.log(`\nMigration complete. ${members.length} member(s) updated.`);
        console.log('No existing data was deleted or overwritten.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.close();
    }
}

migrate();
