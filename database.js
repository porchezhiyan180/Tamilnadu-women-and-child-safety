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
                mobile TEXT UNIQUE NOT NULL,
                email TEXT,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: add email column if missing (for existing databases)
        db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
            // Ignore error if column already exists
        });

        // Create Complaints Table
        db.run(`
            CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_id TEXT UNIQUE NOT NULL,
                user_mobile TEXT,
                type TEXT NOT NULL,
                location TEXT NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                evidence TEXT, -- file path or base64
                status TEXT DEFAULT 'Pending Review',
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_mobile) REFERENCES users(mobile)
            )
        `);

        // Create Appointments Table
        db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_mobile TEXT NOT NULL,
                counselor TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                status TEXT DEFAULT 'Confirmed',
                booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_mobile) REFERENCES users(mobile)
            )
        `);

        console.log('Database tables initialized.');
    });
}

module.exports = db;
