// Simple mock authentication using localStorage for demonstration purposes.

document.addEventListener('DOMContentLoaded', () => {

    // --- ROUTE PROTECTION --- //
    const isPublicPage = window.location.pathname === '/' ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('login.html') ||
        window.location.pathname.includes('signup.html') ||
        window.location.pathname.includes('forgot-password.html') ||
        window.location.pathname.includes('track.html');

    const isLoggedIn = sessionStorage.getItem('tn_portal_logged_in') === 'true';

    // If not logged in and trying to access a protected page (like dashboard.html or complaint.html), redirect to login
    if (!isLoggedIn && !isPublicPage) {
        window.location.href = 'login.html';
        return; // Halt further execution
    }

    // --- LOGOUT LOGIC --- //
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('tn_portal_logged_in');
            sessionStorage.removeItem('tn_portal_user_name');
            window.location.href = 'login.html';
        });
    }

    // --- SIGN UP LOGIC (WITH EMAIL OTP) --- //
    const signupForm = document.getElementById('signupForm');
    const signupStep1 = document.getElementById('signupStep1');
    const signupStep2 = document.getElementById('signupStep2');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const otpInput = document.getElementById('otpInput');
    const displayEmail = document.getElementById('displayEmail');
    const resendOtpBtn = document.getElementById('resendOtpBtn');

    let pendingUser = null;
    let expectedOtp = null;

    if (signupForm) {
        // Step 1: Initial Form Submission
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const feedbackMsg = document.getElementById('signupFeedback');
            const submitBtn = document.getElementById('signupBtn');

            // Basic validation
            if (password !== confirmPassword) {
                showFeedback(feedbackMsg, 'Passwords do not match! (கடவுச்சொற்கள் பொருந்தவில்லை!)', 'error');
                return;
            }

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/auth/register-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    showFeedback(feedbackMsg, data.error || 'Registration request failed.', 'error');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }

                // Transition UI to Step 2
                pendingUser = { email }; // Only strictly need email for verification
                expectedOtp = data.mockOtp; // Taking mock OTP from backend response

                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                signupStep1.classList.add('hidden');
                signupStep2.classList.remove('hidden');

                // Update UI text
                displayEmail.textContent = email;
                showFeedback(feedbackMsg, '', 'hidden');

                // Simulate Email delivery via browser alert
                alert(`MOCK EMAIL:\nTo: ${email}\nSubject: TN Portal Verification\n\nYour OTP is: ${expectedOtp}\nDo not share this with anyone.`);

            } catch (error) {
                console.error(error);
                showFeedback(feedbackMsg, 'Network error. Please try again.', 'error');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });

        // Step 2: Verify OTP
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', async function () {
                const userOtp = otpInput.value.trim();
                const feedbackMsg = document.getElementById('signupFeedback');

                const originalBtnText = verifyOtpBtn.innerHTML;
                verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
                verifyOtpBtn.disabled = true;

                try {
                    const response = await fetch('http://localhost:3000/api/auth/register-verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: pendingUser.email, otp: userOtp })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        showFeedback(feedbackMsg, data.error || 'Invalid OTP! Please try again.', 'error');
                        verifyOtpBtn.innerHTML = originalBtnText;
                        verifyOtpBtn.disabled = false;
                        return;
                    }

                    // Success!
                    showFeedback(feedbackMsg, '<i class="fas fa-check-circle"></i> Account Created Successfully! Redirecting to login...', 'success');

                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);

                } catch (error) {
                    console.error(error);
                    showFeedback(feedbackMsg, 'Network error. Please try again.', 'error');
                    verifyOtpBtn.innerHTML = originalBtnText;
                    verifyOtpBtn.disabled = false;
                }
            });
        }

        // Resend OTP
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', function (e) {
                e.preventDefault();
                expectedOtp = String(Math.floor(1000 + Math.random() * 9000));
                alert(`MOCK EMAIL:\nTo: ${pendingUser.email}\nSubject: TN Portal Verification (Resend)\n\nYour NEW OTP is: ${expectedOtp}\nDo not share this with anyone.`);
                showFeedback(document.getElementById('signupFeedback'), 'A new OTP has been sent to your email.', 'success');
            });
        }
    }


    // --- LOGIN LOGIC --- //
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Clear any existing session to ensure a clean login context
        localStorage.removeItem('tn_portal_current_user');

        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const feedbackMsg = document.getElementById('loginFeedback');
            const submitBtn = document.getElementById('loginBtn');

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating profile...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    showFeedback(feedbackMsg, data.error || 'Invalid email or password. (தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்.)', 'error');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }

                // Login successful
                sessionStorage.setItem('tn_portal_logged_in', 'true');
                sessionStorage.setItem('tn_portal_user_name', data.name);
                sessionStorage.setItem('tn_portal_token', data.token); // Store JWT securely in session

                showFeedback(feedbackMsg, '<i class="fas fa-check-circle"></i> Login Successful! Redirecting...', 'success');

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);

            } catch (error) {
                console.error(error);
                showFeedback(feedbackMsg, 'Network error while attempting to log in.', 'error');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // --- LOGIN LOGIC --- //
    // ... existing login logic ...

    // Helper Function to display feedback
    function showFeedback(element, message, type) {
        element.innerHTML = message;
        element.className = `feedback-msg ${type}`;
        element.classList.remove('hidden');
    }

    // --- FORGOT PASSWORD PAGE LOGIC --- //
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    // Page Elements
    const resetStep1 = document.getElementById('resetStep1');
    const resetStep2 = document.getElementById('resetStep2');
    const resetStep3 = document.getElementById('resetStep3');
    const dotStep1 = document.getElementById('dotStep1');
    const dotStep2 = document.getElementById('dotStep2');
    const dotStep3 = document.getElementById('dotStep3');

    const resetSubtitle = document.getElementById('resetSubtitle');
    const resetFeedback = document.getElementById('resetFeedback');
    const displayResetEmail = document.getElementById('displayResetEmail');

    // Buttons
    const requestEmailOtpBtn = document.getElementById('requestEmailOtpBtn');
    const verifyEmailOtpBtn = document.getElementById('verifyEmailOtpBtn');
    const resendEmailOtpBtn = document.getElementById('resendEmailOtpBtn');
    const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');

    let recoveryEmail = null;
    let recoveryOtp = null;

    if (forgotPasswordForm) {

        // Helper to update progress dots
        function updateProgress(stepIndex) {
            [dotStep1, dotStep2, dotStep3].forEach((dot, index) => {
                if (index < stepIndex) {
                    dot.classList.add('completed');
                    dot.classList.remove('active');
                } else if (index === stepIndex) {
                    dot.classList.add('active');
                    dot.classList.remove('completed');
                } else {
                    dot.classList.remove('active', 'completed');
                }
            });
        }

        // Step 1: Request OTP via Email
        if (requestEmailOtpBtn) {
            requestEmailOtpBtn.addEventListener('click', async () => {
                recoveryEmail = document.getElementById('resetEmail').value.trim();
                if (!recoveryEmail || !recoveryEmail.includes('@')) {
                    showFeedback(resetFeedback, 'Please enter a valid email address.', 'error');
                    return;
                }

                const originalText = requestEmailOtpBtn.innerHTML;
                requestEmailOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                requestEmailOtpBtn.disabled = true;

                try {
                    const response = await fetch('http://localhost:3000/api/auth/forgot-password-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: recoveryEmail })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        showFeedback(resetFeedback, data.error || 'Server error.', 'error');
                        requestEmailOtpBtn.innerHTML = originalText;
                        requestEmailOtpBtn.disabled = false;
                        return;
                    }

                    recoveryOtp = data.mockOtp;

                    requestEmailOtpBtn.innerHTML = originalText;
                    requestEmailOtpBtn.disabled = false;

                    resetStep1.classList.add('hidden');
                    resetStep2.classList.remove('hidden');
                    updateProgress(1); // Move to step 2

                    displayResetEmail.textContent = recoveryEmail;
                    resetSubtitle.textContent = 'Check your email for the verification code.';
                    showFeedback(resetFeedback, '', 'hidden');

                    alert(`MOCK EMAIL:\nTo: ${recoveryEmail}\nSubject: TN Portal Password Reset\n\nYour Password Reset OTP is: ${recoveryOtp}`);

                } catch (error) {
                    console.error(error);
                    showFeedback(resetFeedback, 'Network configuration error.', 'error');
                    requestEmailOtpBtn.innerHTML = originalText;
                    requestEmailOtpBtn.disabled = false;
                }
            });
        }

        // Step 2: Verify OTP
        if (verifyEmailOtpBtn) {
            verifyEmailOtpBtn.addEventListener('click', () => {
                const enteredOtp = document.getElementById('resetOtpInput').value.trim();

                if (enteredOtp === recoveryOtp) {
                    const originalText = verifyEmailOtpBtn.innerHTML;
                    verifyEmailOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
                    verifyEmailOtpBtn.disabled = true;

                    setTimeout(() => {
                        verifyEmailOtpBtn.innerHTML = originalText;
                        verifyEmailOtpBtn.disabled = false;

                        resetStep2.classList.add('hidden');
                        resetStep3.classList.remove('hidden');
                        updateProgress(2); // Move to step 3

                        resetSubtitle.textContent = 'Create a new, strong password.';
                        showFeedback(resetFeedback, '', 'hidden');
                    }, 800);
                } else {
                    showFeedback(resetFeedback, 'Invalid OTP! Please try again.', 'error');
                }
            });
        }

        // Resend OTP
        if (resendEmailOtpBtn) {
            resendEmailOtpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                recoveryOtp = String(Math.floor(1000 + Math.random() * 9000));
                alert(`MOCK EMAIL:\nTo: ${recoveryEmail}\nSubject: TN Portal Password Reset\n\nYour NEW Password Reset OTP is: ${recoveryOtp}`);
                showFeedback(resetFeedback, 'A new OTP has been sent to your email.', 'success');
            });
        }

        // Step 3: Set New Password
        if (saveNewPasswordBtn) {
            saveNewPasswordBtn.addEventListener('click', async () => {
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmNewPassword').value;
                const enteredOtp = document.getElementById('resetOtpInput').value.trim();

                if (newPassword.length < 6) {
                    showFeedback(resetFeedback, 'Password must be at least 6 characters.', 'error');
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showFeedback(resetFeedback, 'Passwords do not match!', 'error');
                    return;
                }

                const originalText = saveNewPasswordBtn.innerHTML;
                saveNewPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
                saveNewPasswordBtn.disabled = true;

                try {
                    const response = await fetch('http://localhost:3000/api/auth/reset-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: recoveryEmail, otp: enteredOtp, newPassword })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        showFeedback(resetFeedback, data.error || 'Error updating password.', 'error');
                        saveNewPasswordBtn.innerHTML = originalText;
                        saveNewPasswordBtn.disabled = false;
                        return;
                    }

                    showFeedback(resetFeedback, '<i class="fas fa-check-circle"></i> Password updated! Redirecting to login...', 'success');

                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);

                } catch (error) {
                    console.error(error);
                    showFeedback(resetFeedback, 'Network configuration error.', 'error');
                    saveNewPasswordBtn.innerHTML = originalText;
                    saveNewPasswordBtn.disabled = false;
                }
            });
        }
    }

});
