document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Chatbot HTML Structure securely into the DOM
    const chatbotHTML = `
        <div id="tnChatbotWidget" class="chatbot-widget">
            <!-- Chat Window -->
            <div id="tnChatbotWindow" class="chatbot-window hidden">
                <div class="chatbot-header">
                    <div class="bot-info">
                        <i class="fas fa-robot bot-icon"></i>
                        <div>
                            <h4>TN Sakthi Bot</h4>
                            <span class="status-indicator">Online</span>
                        </div>
                    </div>
                    <button class="close-chat-btn" id="closeChatBtn"><i class="fas fa-times"></i></button>
                </div>
                
                <div id="tnChatbotMessages" class="chatbot-messages">
                    <div class="message bot-message">
                        Vanakam! 🙏 I am Sakthi, the TN Portal Assistant. How can I help you today?
                        <br><br>You can ask me about:
                        <ul>
                            <li>How to register a complaint</li>
                            <li>Privacy & Safety</li>
                            <li>Emergency Numbers</li>
                            <li>Trauma Counseling</li>
                        </ul>
                    </div>
                </div>
                
                <div class="chatbot-input-area">
                    <input type="text" id="tnChatbotInput" placeholder="Type your question here..." autocomplete="off">
                    <button id="tnChatbotSendBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>

            <!-- Floating Button -->
            <button id="tnChatbotToggleBtn" class="chatbot-toggle-btn">
                <i class="fas fa-comments"></i>
                <span class="tooltip-text">I can help! (உதவி)</span>
            </button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    // 2. DOM Elements
    const toggleBtn = document.getElementById('tnChatbotToggleBtn');
    const closeBtn = document.getElementById('closeChatBtn');
    const chatWindow = document.getElementById('tnChatbotWindow');
    const chatInput = document.getElementById('tnChatbotInput');
    const sendBtn = document.getElementById('tnChatbotSendBtn');
    const messagesContainer = document.getElementById('tnChatbotMessages');

    // 3. Toggle Chat Window
    toggleBtn.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatWindow.classList.add('slide-up');
        toggleBtn.style.transform = 'scale(0)';
        setTimeout(() => chatInput.focus(), 300);
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        chatWindow.classList.remove('slide-up');
        toggleBtn.style.transform = 'scale(1)';
    });

    // 4. Handle Messaging Logic
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add User Message
        appendMessage(text, 'user');
        chatInput.value = '';

        // Simulate Typing Indicator
        const typingId = 'typing-' + Date.now();
        appendMessage('<i class="fas fa-ellipsis-h typing-animation"></i>', 'bot', typingId);

        // Process Bot Response after slight delay
        setTimeout(() => {
            const typingElement = document.getElementById(typingId);
            if (typingElement) typingElement.remove();

            const response = getBotResponse(text.toLowerCase());
            appendMessage(response, 'bot');
        }, 1000 + Math.random() * 1000); // Random delay 1s-2s
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // 5. Append message to UI
    function appendMessage(text, sender, id = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        if (id) msgDiv.id = id;
        msgDiv.innerHTML = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
    }

    // 6. Comprehensive Keyword-Based Conversation Engine
    function getBotResponse(rawInput) {
        const input = rawInput.toLowerCase();

        // Greetings
        if (input.match(/\b(hi|hello|hey|vanakkam|namaste|morning|evening|afternoon)\b/)) {
            return `Hello! Vanakkam 🙏. I am Sakthi, the TN Assistant. I can help you with:
            <ul>
                <li>Filing a complaint securely</li>
                <li>Tracking your case status</li>
                <li>Booking a counseling session</li>
                <li>Privacy and safety rules</li>
            </ul>
            How may I assist you today?`;
        }

        // Emergency
        else if (input.match(/\b(emergency|help|danger|save|police|100|181|1098|call|suicide|urgent)\b/)) {
            return `🚨 <strong>Emergency Numbers for Tamil Nadu:</strong><br>
            <ul>
                <li><strong>100 / 112</strong>: Police Control Room</li>
                <li><strong>181</strong>: Women Helpline</li>
                <li><strong>1098</strong>: Child Helpline</li>
                <li><strong>1930</strong>: Cyber Crime Helpline</li>
            </ul>
            If you are in immediate physical danger, please call 100 right away!`;
        }

        // Registration & Login
        else if (input.match(/\b(register|sign up|create account|join|otp|verify email)\b/)) {
            return `To register, click <strong>"Sign Up"</strong> on the top right of the main page. You will need to provide your Name, Email, and create a Password (minimum 6 characters). We will send a 4-digit OTP to your email to verify your account securely.`;
        }
        else if (input.match(/\b(login|sign in|forgot password|reset password|can't login)\b/)) {
            return `You can login using your registered Email and Password. If you forgot your password, click the <strong>"Forgot Password?"</strong> link on the Login page to reset it.`;
        }

        // Complaint Process & Anonymity
        else if (input.match(/\b(anonymous|hide name|secret|identity)\b/)) {
            return `Yes! You can file a complaint anonymously. On the complaint form, simply check the box that says <strong>"I wish to keep my identity anonymous"</strong>. Your name and contact will be hidden and the system will generate a secure "Anonymous_User_ID" for tracking.`;
        }
        else if (input.match(/\b(file|complaint|report|submit|how to complain)\b/)) {
            return `To file a complaint:
            <ol>
                <li>Login to your account.</li>
                <li>Click <strong>"Report Now"</strong> or <strong>"New Complaint"</strong>.</li>
                <li>Fill in the incident date, time, district, and exact location.</li>
                <li>Describe the incident in detail.</li>
                <li>Upload any evidence (max 10MB).</li>
                <li>Submit to receive your 10-digit Tracking Reference ID.</li>
            </ol>`;
        }

        // Evidence
        else if (input.match(/\b(evidence|upload|photo|video|audio|document|proof|size limit|10mb)\b/)) {
            return `You can upload evidence to support your complaint. We accept Images, Videos, Audio recordings, and Documents (.pdf, .doc, .docx). The maximum total file size allowed is <strong>10MB</strong>.`;
        }

        // Tracking & Status
        else if (input.match(/\b(track|status|progress|reference id|tn-)\b/)) {
            return `You can track your complaint using your 10-digit Reference ID (e.g., TN-123456).<br>
            <br>
            Click <strong>"Track Status"</strong> on the home page or view it directly in your <a href="dashboard.html" style="color:var(--primary-color); text-decoration:underline;">Dashboard</a>. The statuses are typically: <em>Under Review</em>, <em>Assigned to Inspector</em>, and <em>Action Initiated</em>.`;
        }

        // Counseling
        else if (input.match(/\b(counseling|therapy|doctor|trauma|psychologist|mental health|session|stress|fear)\b/)) {
            return `We offer <strong>free, confidential trauma recovery counseling</strong> with Government Certified Specialists.
            <br><br>
            In your Dashboard, you can book an appointment for:
            <ul>
                <li>Online Video Call</li>
                <li>Audio Call</li>
                <li>In-Person session</li>
            </ul>
            Doctors include Clinical Psychologists and Trauma Specialists.`;
        }

        // Privacy & Security & Terms
        else if (input.match(/\b(privacy|safe|secure|data|protect|who can see|hack|leak)\b/)) {
            return `Your data is strictly confidential. Uploaded files are encrypted, and access is restricted by Role-Based Access Control. We do not sell or share data for marketing. Read our full <a href="privacy.html" style="color:var(--primary-color); text-decoration:underline;">Privacy Policy</a>.`;
        }
        else if (input.match(/\b(false|fake|punish|terms|misuse|lie|illegal)\b/)) {
            return `The platform is for genuine cases. Submitting false, malicious, or fake complaints is a violation of our Terms of Use and may result in your account being blocked and potential legal action. Please use the platform responsibly.`;
        }

        // Dashboard & Navigation
        else if (input.match(/\b(dashboard|profile|my account|home)\b/)) {
            return `Your <a href="dashboard.html" style="color:var(--primary-color); text-decoration:underline;">Dashboard</a> is your central hub. There, you can view your submitted complaints, check their status, and book or view upcoming counseling sessions.`;
        }

        // Catch-all
        else {
            return `I'm sorry, I'm just a simple assistant and didn't quite understand. Could you rephrase your question?
            <br><br>
            You can ask me about:
            <ul>
                <li>"How to register a complaint"</li>
                <li>"How to track my case"</li>
                <li>"How to book counseling"</li>
                <li>"Emergency numbers"</li>
            </ul>
            For immediate physical danger, please call <strong>100</strong>.`;
        }
    }
});
