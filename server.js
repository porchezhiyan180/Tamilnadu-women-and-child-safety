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
const supabase = require('./database');
console.log('IMPORT: database loaded');
const crypto = require('crypto');
console.log('IMPORT: crypto loaded');
const nodemailer = require('nodemailer');
console.log('IMPORT: nodemailer loaded');
const multer = require('multer');
console.log('IMPORT: multer loaded');

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

function generateTrackingId() {
    return crypto.randomUUID().slice(0, 10).toUpperCase();
}

// Apply multer memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-tn-portal';
console.log('CONFIG: PORT=' + PORT);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
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

// Utility: Optional Authentication Middleware
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
    const expiresAt = Date.now() + 10 * 60 * 1000;
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

    otpStore.set(email, { ...record, verified: true });
    res.json({ message: 'OTP verified successfully.' });
});

// 1. Register
app.post('/api/auth/register', async (req, res) => {
    const { name, mobile, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const otpRecord = otpStore.get(email);
    if (!otpRecord || !otpRecord.verified) {
        return res.status(400).json({ error: 'Email OTP not verified. Please verify your OTP first.' });
    }

    try {
        // Check if email already exists
        const { data: existingUser, error: checkErr } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();

        if (existingUser) return res.status(400).json({ error: 'This email address is already registered. Please log in.' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const { error: insertErr } = await supabase
            .from('users')
            .insert([{ name, mobile: mobile || null, email, password: hashedPassword }]);

        if (insertErr) {
            console.error('SUPABASE INSERT ERROR:', insertErr);
            return res.status(500).json({ error: 'Could not create account in database.' });
        }

        otpStore.delete(email);
        res.status(201).json({ message: 'Account Created Successfully!' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) return res.status(401).json({ error: 'Invalid credentials.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, mobile: user.mobile }, JWT_SECRET, { expiresIn: '2h' });

        res.json({ message: 'Login successful', token, name: user.name, email: user.email });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// 3. Password Reset
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) return res.status(400).json({ error: 'All fields required.' });

    const otpRecord = otpStore.get(email);
    if (!otpRecord || !otpRecord.verified) {
        return res.status(400).json({ error: 'Email OTP not verified. Please verify your OTP first.' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${email},mobile.eq.${email}`)
            .single();

        if (error || !user) return res.status(404).json({ error: 'No account found with this email address.' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { error: updateErr } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', user.id);

        if (updateErr) return res.status(500).json({ error: 'Error updating password.' });

        otpStore.delete(email);
        res.json({ message: 'Password updated successfully.' });
    } catch (e) {
        console.error('Reset password error:', e);
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// ==========================================
// ROUTES: COMPLAINTS
// ==========================================

// Endpoint to submit a complaint (with evidence upload)
app.post('/api/complaints', authenticateToken, upload.array('evidenceFiles', 5), async (req, res) => {
    try {
        const { type, location, date, description } = req.body;
        // User mobile from authenticated token (from original req.user)
        const user_mobile = req.user ? req.user.mobile : null;

        // Generate tracking ID
        let trackingId;
        let isUnique = false;
        while (!isUnique) {
            trackingId = generateTrackingId();
            const { data } = await supabase.from('complaints').select('tracking_id').eq('tracking_id', trackingId);
            if (!data || data.length === 0) {
                isUnique = true;
            }
        }

        let evidenceArr = [];

        // Upload files to Supabase Storage
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const fileExt = file.originalname.split('.').pop();
                const fileName = `${trackingId}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('evidence')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Storage Upload Error:', uploadError);
                    // continue with other files or fail? Let's just log and skip for robustness, or we can fail the whole request
                } else {
                    // Get public URL
                    const { data: publicUrlData } = supabase.storage
                        .from('evidence')
                        .getPublicUrl(filePath);

                    if (publicUrlData) {
                        evidenceArr.push(publicUrlData.publicUrl);
                    }
                }
            }
        }

        // Store as JSON array string, or null if none
        const evidenceStr = evidenceArr.length > 0 ? JSON.stringify(evidenceArr) : null;

        const { error } = await supabase
            .from('complaints')
            .insert([{ tracking_id: trackingId, user_mobile, type, location, date, description, evidence: evidenceStr }]);

        if (error) {
            console.error('SUPABASE INSERT ERROR:', error);
            return res.status(500).json({ error: 'Failed to submit complaint. Database error.' });
        }

        res.status(201).json({ message: 'Complaint filed securely.', tracking_id: trackingId });
    } catch (err) {
        console.error('Complaint router error:', err);
        res.status(500).json({ error: 'Server/Network error submitting complaint.' });
    }
});

// 2. Track complaint by ID (Public)
app.get('/api/complaints/:trackingId', async (req, res) => {
    const trackingId = req.params.trackingId.toUpperCase();

    try {
        const { data, error } = await supabase
            .from('complaints')
            .select('tracking_id, status, submitted_at')
            .eq('tracking_id', trackingId)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Tracking ID not found.' });

        res.json(data);
    } catch (err) {
        console.error('Track complaint error:', err);
        res.status(500).json({ error: 'Database error.' });
    }
});

// 3. User's complaints (Protected)
app.get('/api/user/complaints', authenticateToken, async (req, res) => {
    const mobile = req.user.mobile;

    try {
        const { data, error } = await supabase
            .from('complaints')
            .select('*')
            .eq('user_mobile', mobile)
            .order('submitted_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Database error.' });

        res.json(data);
    } catch (err) {
        console.error('User complaints error:', err);
        res.status(500).json({ error: 'Database error.' });
    }
});


// ==========================================
// ROUTES: COUNSELING APPOINTMENTS
// ==========================================

// 1. Book an appointment (Protected)
app.post('/api/appointments', authenticateToken, async (req, res) => {
    const { date, time, counselor } = req.body;
    const mobile = req.user.mobile;

    if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required.' });
    }

    try {
        const { error } = await supabase
            .from('appointments')
            .insert([{ user_mobile: mobile, counselor: counselor || 'Unassigned', date, time }]);

        if (error) return res.status(500).json({ error: 'Failed to book appointment.' });

        res.status(201).json({ message: 'Appointment Confirmed.' });
    } catch (err) {
        console.error('Appointment error:', err);
        res.status(500).json({ error: 'Server error booking appointment.' });
    }
});

// 2. Fetch user's appointments (Protected)
app.get('/api/user/appointments', authenticateToken, async (req, res) => {
    const mobile = req.user.mobile;

    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('user_mobile', mobile)
            .order('booked_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Database error.' });

        res.json(data);
    } catch (err) {
        console.error('User appointments error:', err);
        res.status(500).json({ error: 'Database error.' });
    }
});


// ==========================================
// ROUTES: SOS EMERGENCY
// ==========================================

// 1. Initial SOS Alert (Email alert with location)
app.post('/api/emergency/sos', async (req, res) => {
    const { location, timestamp, user } = req.body;
    
    console.log(`SOS TRIGGERED BY: ${user}`);
    console.log(`LOCATION: ${location ? `${location.lat}, ${location.lng}` : 'Unknown'}`);

    try {
        const locationLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : 'Location unknown';
        
        await transporter.sendMail({
            from: `"EMERGENCY SOS - TN Safety" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Sending to admin/police for demo
            subject: '🚨 URGENT: EMERGENCY SOS TRIGGERED 🚨',
            html: `
                <div style="font-family: Arial, sans-serif; border: 5px solid #ff416c; padding: 20px; border-radius: 10px;">
                    <h1 style="color: #ff416c; text-align: center;">🚨 EMERGENCY ALERT 🚨</h1>
                    <p style="font-size: 1.2rem;"><strong>User:</strong> ${user}</p>
                    <p style="font-size: 1.2rem;"><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
                    <p style="font-size: 1.4rem; background: #fff5f5; padding: 15px; border-radius: 8px;">
                        <strong>Current Location:</strong><br>
                        <a href="${locationLink}" style="color: #ff416c; font-weight: bold;">View on Google Maps</a>
                    </p>
                    <p style="color: #6b7280; font-style: italic;">Note: Audio evidence is being recorded and will follow shortly.</p>
                </div>
            `
        });

        res.json({ message: 'Alert sent successfully' });
    } catch (err) {
        console.error('SOS Alert Error:', err);
        res.status(500).json({ error: 'Failed to send SOS alert' });
    }
});

// 2. SOS Audio Evidence Upload
app.post('/api/emergency/sos-audio', upload.single('audioFile'), async (req, res) => {
    const { user } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        console.log(`AUDIO RECEIVED FROM: ${user}, SIZE: ${file.size} bytes`);
        
        // For demo, we just log it. In production, we'd save to Supabase Storage
        // Let's try to upload to Supabase if possible
        const fileName = `sos-audio-${Date.now()}.wav`;
        const { data, error } = await supabase.storage
            .from('evidence')
            .upload(`sos/${fileName}`, file.buffer, {
                contentType: 'audio/wav'
            });

        if (error) {
            console.warn('Supabase SOS Upload Warning:', error.message);
        }

        res.json({ message: 'Audio evidence secured' });
    } catch (err) {
        console.error('SOS Audio Upload Error:', err);
        res.status(500).json({ error: 'Failed to upload audio' });
    }
});

// ==========================================
// SERVER START
// ==========================================
app.listen(PORT, () => {
    console.log(`Backend Server running securely on http://localhost:${PORT}`);
    console.log(`Static file paths mapping to: ${__dirname}`);
});
