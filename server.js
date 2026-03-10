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
const nodemailer = require('nodemailer');
console.log('IMPORT: nodemailer loaded');

// ==========================================
// EMAIL TRANSPORTER SETUP
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// IN-MEMORY OTP STORE (TTL: 10 minutes)
// ==========================================
const otpStore = new Map(); // key: email, value: { otp, expiresAt, verified }

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

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

// 0a. Send OTP to email
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email, { otp, expiresAt, verified: false });

    try {
        await transporter.sendMail({
            from: `"Tamil Nadu Safety Portal" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your OTP - Tamil Nadu Safety Portal',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 30px;">
                    <h2 style="color: #8B0000; text-align: center;">Tamil Nadu Safety Portal</h2>
                    <p>Your One-Time Password (OTP) is:</p>
                    <div style="font-size: 2.5rem; font-weight: bold; letter-spacing: 12px; text-align: center; color: #8B0000; padding: 20px; background: #f9f9f9; border-radius: 6px;">${otp}</div>
                    <p style="margin-top: 20px; color: #666; font-size: 0.9rem;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
                </div>
            `
        });
        res.json({ message: 'OTP sent successfully to your email.' });
    } catch (err) {
        console.error('Email send error:', err);
        res.status(500).json({ error: 'Failed to send OTP email. Please try again.' });
    }
});

// 0b. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

    const record = otpStore.get(email);
    if (!record) return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== otp.trim()) return res.status(400).json({ error: 'Invalid OTP. Please try again.' });

    // Mark as verified
    otpStore.set(email, { ...record, verified: true });
    res.json({ message: 'OTP verified successfully.' });
});

// 1. Register (OTP verified by backend email system)
app.post('/api/auth/register', async (req, res) => {
    const { name, mobile, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Check OTP was verified for this email
    const otpRecord = otpStore.get(email);
    if (!otpRecord || !otpRecord.verified) {
        return res.status(400).json({ error: 'Email OTP not verified. Please verify your OTP first.' });
    }

    // Check if email already exists
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row) return res.status(400).json({ error: 'This email address is already registered. Please log in.' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            db.run('INSERT INTO users (name, mobile, email, password) VALUES (?, ?, ?, ?)', [name, mobile || null, email, hashedPassword], function (err) {
                if (err) {
                    // Fallback without mobile column
                    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function (err2) {
                        if (err2) return res.status(500).json({ error: 'Could not create account in database.' });
                        otpStore.delete(email);
                        res.status(201).json({ message: 'Account Created Successfully!' });
                    });
                    return;
                }
                otpStore.delete(email);
                res.status(201).json({ message: 'Account Created Successfully!' });
            });
        } catch (error) {
            console.error('Error generating request:', error);
            res.status(500).json({ error: 'Server error generating request' });
        }
    });
});

// 3. Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '2h' });

        res.json({ message: 'Login successful', token, name: user.name, email: user.email });
    });
});

// 4. Password Reset Modify (OTP verified by backend email system)
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) return res.status(400).json({ error: 'All fields required.' });

    // Check OTP was verified for this email
    const otpRecord = otpStore.get(email);
    if (!otpRecord || !otpRecord.verified) {
        return res.status(400).json({ error: 'Email OTP not verified. Please verify your OTP first.' });
    }

    // Try to find user by email column first, then fallback to mobile
    db.get('SELECT * FROM users WHERE email = ? OR mobile = ?', [email, email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'No account found with this email address.' });

        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], function (err) {
                if (err) return res.status(500).json({ error: 'Error updating password.' });
                otpStore.delete(email);
                res.json({ message: 'Password updated successfully.' });
            });
        } catch (e) {
            res.status(500).json({ error: 'Internal server error.' });
        }
    });
});


// ==========================================
// ROUTES: COMPLAINTS 
// ==========================================

// 1. Submit a generic complaint
app.post('/api/complaints', optionalAuthenticateToken, (req, res) => {
    // Note: This API accepts non-authenticated requests for anonymity if needed, but attaches mobile if user is authenticated
    const { type, location, date, description } = req.body;
    const user_mobile = req.user ? req.user.mobile : null;
    const trackingId = crypto.randomUUID().slice(0, 10).toUpperCase();

    // Verify fields
    if (!type || !location || !date || !description) {
        return res.status(400).json({ error: 'Missing required complaint fields.' });
    }

    db.run(
        'INSERT INTO complaints (tracking_id, user_mobile, type, location, date, description) VALUES (?, ?, ?, ?, ?, ?)',
        [trackingId, user_mobile, type, location, date, description],
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
    const mobile = req.user.mobile;
    db.all('SELECT * FROM complaints WHERE user_mobile = ? ORDER BY submitted_at DESC', [mobile], (err, rows) => {
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
    const mobile = req.user.mobile;

    if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required.' });
    }

    db.run(
        'INSERT INTO appointments (user_mobile, counselor, date, time) VALUES (?, ?, ?, ?)',
        [mobile, counselor || 'Unassigned', date, time],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to book appointment.' });
            res.status(201).json({ message: 'Appointment Confirmed.', id: this.lastID });
        }
    );
});

// 2. Fetch user's appointments (Protected)
app.get('/api/user/appointments', authenticateToken, (req, res) => {
    const mobile = req.user.mobile;
    db.all('SELECT * FROM appointments WHERE user_mobile = ? ORDER BY booked_at DESC', [mobile], (err, rows) => {
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
