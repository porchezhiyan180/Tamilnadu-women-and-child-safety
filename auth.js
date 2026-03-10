// No Firebase — OTP is handled by the backend email system

document.addEventListener('DOMContentLoaded', () => {

    // --- ROUTE PROTECTION --- //
    const isPublicPage = window.location.pathname === '/' ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('login.html') ||
        window.location.pathname.includes('signup.html') ||
        window.location.pathname.includes('forgot-password.html') ||
        window.location.pathname.includes('track.html');

    const isLoggedIn = sessionStorage.getItem('tn_portal_logged_in') === 'true';

    if (!isLoggedIn && !isPublicPage) {
        window.location.href = 'login.html';
        return;
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

    // Helper: display feedback
    function showFeedback(element, message, type) {
        element.innerHTML = message;
        element.className = `feedback-msg ${type}`;
        element.classList.remove('hidden');
    }

    // Helper: mask email for display   e.g. ja***@gmail.com
    function maskEmail(email) {
        const [user, domain] = email.split('@');
        const masked = user.slice(0, 2) + '***';
        return `${masked}@${domain}`;
    }

    // ==========================================
    // SIGN UP LOGIC (EMAIL OTP)
    // ==========================================
    const signupForm = document.getElementById('signupForm');
    const signupStep1 = document.getElementById('signupStep1');
    const signupStep2 = document.getElementById('signupStep2');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const otpInput = document.getElementById('otpInput');
    const displayEmail = document.getElementById('displayEmail');
    const resendOtpBtn = document.getElementById('resendOtpBtn');

    let pendingUser = null;

    if (signupForm) {
        // Step 1: Send OTP
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('signupName').value.trim();
            const mobile = document.getElementById('signupMobile').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const feedbackMsg = document.getElementById('signupFeedback');
            const submitBtn = document.getElementById('signupBtn');

            if (password !== confirmPassword) {
                showFeedback(feedbackMsg, 'Passwords do not match! (கடவுச்சொற்கள் பொருந்தவில்லை!)', 'error');
                return;
            }

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (!response.ok) {
                    showFeedback(feedbackMsg, data.error || 'Failed to send OTP. Please try again.', 'error');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }

                // Save pending user
                pendingUser = { name, mobile, email, password };

                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                signupStep1.classList.add('hidden');
                signupStep2.classList.remove('hidden');
                displayEmail.textContent = maskEmail(email);
                showFeedback(feedbackMsg, `<i class="fas fa-check-circle"></i> OTP sent to ${maskEmail(email)}. Check your inbox.`, 'success');

            } catch (error) {
                console.error(error);
                showFeedback(feedbackMsg, 'Network error. Please check your connection.', 'error');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });

        // Step 2: Verify OTP → Register
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', async function () {
                const userOtp = otpInput.value.trim();
                const feedbackMsg = document.getElementById('signupFeedback');

                const originalBtnText = verifyOtpBtn.innerHTML;
                verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
                verifyOtpBtn.disabled = true;

                try {
                    // 1. Verify OTP
                    const verifyResponse = await fetch('http://localhost:3000/api/auth/verify-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: pendingUser.email, otp: userOtp })
                    });

                    const verifyData = await verifyResponse.json();

                    if (!verifyResponse.ok) {
                        showFeedback(feedbackMsg, verifyData.error || 'Invalid OTP. Please try again.', 'error');
                        verifyOtpBtn.innerHTML = originalBtnText;
                        verifyOtpBtn.disabled = false;
                        return;
                    }

                    // 2. Register user
                    const registerResponse = await fetch('http://localhost:3000/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: pendingUser.name,
                            mobile: pendingUser.mobile,
                            email: pendingUser.email,
                            password: pendingUser.password
                        })
                    });

                    const registerData = await registerResponse.json();

                    if (!registerResponse.ok) {
                        showFeedback(feedbackMsg, registerData.error || 'Could not create account. Please try again.', 'error');
                        verifyOtpBtn.innerHTML = originalBtnText;
                        verifyOtpBtn.disabled = false;
                        return;
                    }

                    showFeedback(feedbackMsg, '<i class="fas fa-check-circle"></i> Account Created Successfully! Redirecting to login...', 'success');
                    setTimeout(() => { window.location.href = 'login.html'; }, 2000);

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
            resendOtpBtn.addEventListener('click', async function (e) {
                e.preventDefault();
                if (!pendingUser) return;
                const feedbackMsg = document.getElementById('signupFeedback');

                try {
                    const response = await fetch('http://localhost:3000/api/auth/send-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: pendingUser.email })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        showFeedback(feedbackMsg, `<i class="fas fa-paper-plane"></i> New OTP sent to ${maskEmail(pendingUser.email)}.`, 'success');
                    } else {
                        showFeedback(feedbackMsg, data.error || 'Failed to resend OTP.', 'error');
                    }
                } catch {
                    showFeedback(feedbackMsg, 'Network error while resending OTP.', 'error');
                }
            });
        }
    }


    // ==========================================
    // LOGIN LOGIC
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        localStorage.removeItem('tn_portal_current_user');

        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value.trim();
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
                    showFeedback(feedbackMsg, data.error || 'Invalid credentials. (தவறான தகவல்.)', 'error');
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }

                sessionStorage.setItem('tn_portal_logged_in', 'true');
                sessionStorage.setItem('tn_portal_user_name', data.name);
                sessionStorage.setItem('tn_portal_token', data.token);

                showFeedback(feedbackMsg, '<i class="fas fa-check-circle"></i> Login Successful! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);

            } catch (error) {
                console.error(error);
                showFeedback(feedbackMsg, 'Network error while attempting to log in.', 'error');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }


    // ==========================================
    // FORGOT PASSWORD LOGIC (EMAIL OTP)
    // ==========================================
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    const resetStep1 = document.getElementById('resetStep1');
    const resetStep2 = document.getElementById('resetStep2');
    const resetStep3 = document.getElementById('resetStep3');
    const dotStep1 = document.getElementById('dotStep1');
    const dotStep2 = document.getElementById('dotStep2');
    const dotStep3 = document.getElementById('dotStep3');
    const resetSubtitle = document.getElementById('resetSubtitle');
    const resetFeedback = document.getElementById('resetFeedback');
    const displayResetEmail = document.getElementById('displayResetEmail');

    const requestEmailOtpBtn = document.getElementById('requestEmailOtpBtn');
    const verifyEmailOtpBtn = document.getElementById('verifyEmailOtpBtn');
    const resendEmailOtpBtn = document.getElementById('resendEmailOtpBtn');
    const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');

    let recoveryEmail = null;

    if (forgotPasswordForm) {

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

        // Step 1: Send OTP to email
        if (requestEmailOtpBtn) {
            requestEmailOtpBtn.addEventListener('click', async () => {
                const emailInput = document.getElementById('resetEmail');
                if (!emailInput) return;
                recoveryEmail = emailInput.value.trim();

                if (!recoveryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
                    showFeedback(resetFeedback, 'Please enter a valid email address.', 'error');
                    return;
                }

                const originalText = requestEmailOtpBtn.innerHTML;
                requestEmailOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                requestEmailOtpBtn.disabled = true;

                try {
                    const response = await fetch('http://localhost:3000/api/auth/send-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: recoveryEmail })
                    });

                    const data = await response.json();
                    requestEmailOtpBtn.innerHTML = originalText;
                    requestEmailOtpBtn.disabled = false;

                    if (!response.ok) {
                        showFeedback(resetFeedback, data.error || 'Failed to send OTP. Please try again.', 'error');
                        return;
                    }

                    resetStep1.classList.add('hidden');
                    resetStep2.classList.remove('hidden');
                    updateProgress(1);
                    displayResetEmail.textContent = maskEmail(recoveryEmail);
                    resetSubtitle.textContent = 'Check your email for the verification code.';
                    showFeedback(resetFeedback, `<i class="fas fa-check-circle"></i> Recovery OTP sent to ${maskEmail(recoveryEmail)}.`, 'success');

                } catch (error) {
                    console.error(error);
                    showFeedback(resetFeedback, 'Network error. Please try again.', 'error');
                    requestEmailOtpBtn.innerHTML = originalText;
                    requestEmailOtpBtn.disabled = false;
                }
            });
        }

        // Step 2: Verify OTP
        if (verifyEmailOtpBtn) {
            verifyEmailOtpBtn.addEventListener('click', async () => {
                const enteredOtp = document.getElementById('resetOtpInput').value.trim();

                const originalText = verifyEmailOtpBtn.innerHTML;
                verifyEmailOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
                verifyEmailOtpBtn.disabled = true;

                try {
                    const response = await fetch('http://localhost:3000/api/auth/verify-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: recoveryEmail, otp: enteredOtp })
                    });

                    const data = await response.json();
                    verifyEmailOtpBtn.innerHTML = originalText;
                    verifyEmailOtpBtn.disabled = false;

                    if (!response.ok) {
                        showFeedback(resetFeedback, data.error || 'Invalid OTP. Please try again.', 'error');
                        return;
                    }

                    resetStep2.classList.add('hidden');
                    resetStep3.classList.remove('hidden');
                    updateProgress(2);
                    resetSubtitle.textContent = 'Create a new, strong password.';
                    showFeedback(resetFeedback, '', 'hidden');

                } catch (error) {
                    verifyEmailOtpBtn.innerHTML = originalText;
                    verifyEmailOtpBtn.disabled = false;
                    showFeedback(resetFeedback, 'Network error. Please try again.', 'error');
                }
            });
        }

        // Resend OTP
        if (resendEmailOtpBtn) {
            resendEmailOtpBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!recoveryEmail) return;

                try {
                    const response = await fetch('http://localhost:3000/api/auth/send-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: recoveryEmail })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        showFeedback(resetFeedback, `<i class="fas fa-paper-plane"></i> New OTP sent to ${maskEmail(recoveryEmail)}.`, 'success');
                    } else {
                        showFeedback(resetFeedback, data.error || 'Failed to resend OTP.', 'error');
                    }
                } catch {
                    showFeedback(resetFeedback, 'Network error while resending OTP.', 'error');
                }
            });
        }

        // Step 3: Set New Password
        if (saveNewPasswordBtn) {
            saveNewPasswordBtn.addEventListener('click', async () => {
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmNewPassword').value;

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
                        body: JSON.stringify({ email: recoveryEmail, newPassword })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        showFeedback(resetFeedback, data.error || 'Error updating password.', 'error');
                        saveNewPasswordBtn.innerHTML = originalText;
                        saveNewPasswordBtn.disabled = false;
                        return;
                    }

                    showFeedback(resetFeedback, '<i class="fas fa-check-circle"></i> Password updated! Redirecting to login...', 'success');
                    setTimeout(() => { window.location.href = 'login.html'; }, 2000);

                } catch (error) {
                    console.error(error);
                    showFeedback(resetFeedback, 'Network error. Please try again.', 'error');
                    saveNewPasswordBtn.innerHTML = originalText;
                    saveNewPasswordBtn.disabled = false;
                }
            });
        }
    }

    // Header Shrink on Scroll
    const header = document.querySelector('.main-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('header-minimized');
            } else {
                header.classList.remove('header-minimized');
            }
        });
    }

});
