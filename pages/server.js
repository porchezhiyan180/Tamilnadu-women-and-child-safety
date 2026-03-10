console.log('IMPORT: Start of server.js');
require('dotenv').config();
console.log('IMPORT: dotenv loaded');
const express = require('express');
console.log('IMPORT: express loaded');
const cors = require('cors');
console.log('IMPORT: cors loaded');
const bcrypt = require('bcryptjs');
console.log('IMPORT: bcryptjs loaded');
const jwt = require('jsonwebtoken');
console.log('IMPORT: jsonwebtoken loaded');
const db = require('./database'); 
console.log('IMPORT: database loaded');
const crypto = require('crypto');
console.log('IMPORT: crypto loaded');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-tn-portal';
console.log('CONFIG: PORT=' + PORT);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (assuming they are in the same or 'public' directory)
// For now, let's just serve the root directory where html files are
app.use(express.static(__dirname));

// Utility: Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Utility: Optional Authentication Middleware (for public routes that can also accept logged-in users)
const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        } else {
            req.user = null;
        }
        next();
    });
};

// ==========================================
// ROUTES: AUTHENTICATION
// ==========================================

// In-memory mock storage for temporary OTPs until verified
const pendingVerifications = new Map();

// 1. Register Request (Sends mock OTP)
app.post('/api/auth/register-request', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check if user exists
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row) return res.status(400).json({ error: 'Email is already registered.' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const expectedOtp = Math.floor(1000 + Math.random() * 9000).toString();

            // Store pending user
            pendingVerifications.set(email, { name, email, password: hashedPassword, expectedOtp });

            // In a real app we would send the email here
            console.log(`MOCK EMAIL SENT TO ${email}: OTP is ${expectedOtp}`);

            res.json({ message: 'OTP sent to email.', mockOtp: expectedOtp }); // Sending mockOtp for frontend dev UI
        } catch (error) {
            res.status(500).json({ error: 'Error generating request' });
        }
    });
});

// 2. Register Verify (Creates user)
app.post('/api/auth/register-verify', (req, res) => {
    const { email, otp } = req.body;
    const pendingDetails = pendingVerifications.get(email);

    if (!pendingDetails) {
        return res.status(400).json({ error: 'No pending registration found.' });
    }
    if (pendingDetails.expectedOtp !== otp) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }

    const { name, password } = pendingDetails;

    // Insert to DB
    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Could not create account in database.' });
        }
        pendingVerifications.delete(email);
        res.status(201).json({ message: 'Account Created Successfully!' });
    });
});

// 3. Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '2h' });

        res.json({ message: 'Login successful', token, name: user.name, email: user.email });
    });
});

// 4. Forgot Password Request
app.post('/api/auth/forgot-password-request', (req, res) => {
    const { email } = req.body;

    db.get('SELECT email FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'Email not registered.' });

        const expectedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        pendingVerifications.set(email + '_reset', { expectedOtp });

        console.log(`MOCK EMAIL SENT TO ${email}: Reset OTP is ${expectedOtp}`);

        res.json({ message: 'Reset OTP sent to email.', mockOtp: expectedOtp });
    });
});

// 5. Password Reset Modify
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    const pendingReset = pendingVerifications.get(email + '_reset');

    if (!pendingReset || pendingReset.expectedOtp !== otp) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], function (err) {
            if (err) return res.status(500).json({ error: 'Error updating password.' });

            pendingVerifications.delete(email + '_reset');
            res.json({ message: 'Password updated successfully.' });
        });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// ==========================================
// ROUTES: COMPLAINTS 
// ==========================================

// 1. Submit a generic complaint
app.post('/api/complaints', optionalAuthenticateToken, (req, res) => {
    // Note: This API accepts non-authenticated requests for anonymity if needed, but attaches email if user is authenticated
    const { type, location, date, description } = req.body;
    const user_email = req.user ? req.user.email : null;
    const trackingId = crypto.randomUUID().slice(0, 10).toUpperCase();

    // Verify fields
    if (!type || !location || !date || !description) {
        return res.status(400).json({ error: 'Missing required complaint fields.' });
    }

    db.run(
        'INSERT INTO complaints (tracking_id, user_email, type, location, date, description) VALUES (?, ?, ?, ?, ?, ?)',
        [trackingId, user_email, type, location, date, description],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to submit complaint.' });
            res.status(201).json({ message: 'Complaint filed securely.', tracking_id: trackingId });
        }
    );
});

// 2. Track complaint by ID (Public Access)
app.get('/api/complaints/:trackingId', (req, res) => {
    const trackingId = req.params.trackingId.toUpperCase();
    db.get('SELECT tracking_id, status, submitted_at FROM complaints WHERE tracking_id = ?', [trackingId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Tracking ID not found.' });

        res.json(row);
    });
});

// 3. User's specific complaints (Protected)
app.get('/api/user/complaints', authenticateToken, (req, res) => {
    const email = req.user.email;
    db.all('SELECT * FROM complaints WHERE user_email = ? ORDER BY submitted_at DESC', [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});


// ==========================================
// ROUTES: COUNSELING APPOINTMENTS
// ==========================================

// 1. Book an appointment (Protected)
app.post('/api/appointments', authenticateToken, (req, res) => {
    const { date, time, counselor } = req.body;
    const email = req.user.email;

    if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required.' });
    }

    db.run(
        'INSERT INTO appointments (user_email, counselor, date, time) VALUES (?, ?, ?, ?)',
        [email, counselor || 'Unassigned', date, time],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to book appointment.' });
            res.status(201).json({ message: 'Appointment Confirmed.', id: this.lastID });
        }
    );
});

// 2. Fetch user's appointments (Protected)
app.get('/api/user/appointments', authenticateToken, (req, res) => {
    const email = req.user.email;
    db.all('SELECT * FROM appointments WHERE user_email = ? ORDER BY booked_at DESC', [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});


// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`Backend Server running securely on http://localhost:${PORT}`);
    console.log(`Static file paths mapping to: ${__dirname}`);
});
