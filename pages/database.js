const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite Database (creates database.sqlite if it doesn't exist)
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Drop existing tables if needed during development (optional)
        // db.run(`DROP TABLE IF EXISTS users`);
        // db.run(`DROP TABLE IF EXISTS complaints`);
        // db.run(`DROP TABLE IF EXISTS appointments`);

        // Create Users Table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Complaints Table
        db.run(`
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_id TEXT UNIQUE NOT NULL,
                user_email TEXT,
                type TEXT NOT NULL,
                location TEXT NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                evidence TEXT, -- file path or base64
                status TEXT DEFAULT 'Pending Review',
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_email) REFERENCES users(email)
            )
        `);

        // Create Appointments Table
        db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                counselor TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                status TEXT DEFAULT 'Confirmed',
                booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_email) REFERENCES users(email)
            )
        `);

        console.log('Database tables initialized.');
    });
}

module.exports = db;
