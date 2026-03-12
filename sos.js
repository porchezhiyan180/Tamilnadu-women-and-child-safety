document.addEventListener('DOMContentLoaded', () => {
    // Inject SOS Button and Modal into the body
    const sosHtml = `
        <div id="sosBtn" class="sos-btn">
            <i class="fas fa-bell"></i>
            <span>SOS</span>
        </div>

        <div id="sosModal" class="sos-modal">
            <div class="sos-modal-content">
                <h2>EMERGENCY SOS</h2>
                <p>Initiating emergency protocols. Your safety is our priority.</p>
                
                <div class="sos-status-list">
                    <div class="sos-status-item" id="statusLocation">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Fetching Location...</span>
                        <div class="loader"></div>
                    </div>
                    <div class="sos-status-item" id="statusAudio">
                        <i class="fas fa-microphone"></i>
                        <span>Preparing Audio Evidence...</span>
                        <div class="loader"></div>
                    </div>
                    <div class="sos-status-item" id="statusAlert">
                        <i class="fas fa-paper-plane"></i>
                        <span>Sending Alerts...</span>
                        <div class="loader"></div>
                    </div>
                </div>

                <button id="cancelSos" class="sos-cancel-btn">CANCEL SOS</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', sosHtml);

    const sosBtn = document.getElementById('sosBtn');
    const sosModal = document.getElementById('sosModal');
    const cancelSos = document.getElementById('cancelSos');
    
    const statusLocation = document.getElementById('statusLocation');
    const statusAudio = document.getElementById('statusAudio');
    const statusAlert = document.getElementById('statusAlert');

    let isSosActive = false;
    let mediaRecorder;
    let audioChunks = [];

    sosBtn.addEventListener('click', startSos);
    cancelSos.addEventListener('click', stopSos);

    async function startSos() {
        if (isSosActive) return;
        isSosActive = true;
        
        sosModal.classList.add('active');
        
        // 1. Get Location
        let locationData = null;
        try {
            locationData = await getGeoLocation();
            updateStatus(statusLocation, 'Location Captured', true);
        } catch (err) {
            updateStatus(statusLocation, 'Location Denied/Failed', false, true);
        }

        // 2. Start Audio Recording (30 seconds)
        try {
            await startAudioRecording();
            updateStatus(statusAudio, 'Recording Evidence...', true);
        } catch (err) {
            updateStatus(statusAudio, 'Audio Recording Failed', false, true);
        }

        // 3. Send Initial Alert with Location
        try {
            await sendSosAlert(locationData);
            updateStatus(statusAlert, 'Emergency Alerts Sent!', true);
        } catch (err) {
            updateStatus(statusAlert, 'Alert Failed', false, true);
        }

        // Wait for 30 seconds of recording then upload audio
        setTimeout(async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, 30000);
    }

    function stopSos() {
        isSosActive = false;
        sosModal.classList.remove('active');
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        // Reset status
        resetStatus(statusLocation, 'Fetching Location...');
        resetStatus(statusAudio, 'Preparing Audio Evidence...');
        resetStatus(statusAlert, 'Sending Alerts...');
    }

    function updateStatus(element, text, success, error = false) {
        element.querySelector('span').innerText = text;
        const loader = element.querySelector('.loader');
        if (loader) loader.remove();
        
        const icon = element.querySelector('i');
        if (error) {
            icon.className = 'fas fa-exclamation-triangle';
            icon.style.color = '#ef4444';
        } else if (success) {
            icon.className = 'fas fa-check-circle';
            icon.style.color = '#10b981';
        }
    }

    function resetStatus(element, text) {
        element.querySelector('span').innerText = text;
        const icon = element.querySelector('i');
        icon.className = icon.getAttribute('data-original-class') || icon.className;
        icon.style.color = '';
        if (!element.querySelector('.loader')) {
            const loader = document.createElement('div');
            loader.className = 'loader';
            element.appendChild(loader);
        }
    }

    // Save original classes for reset
    document.querySelectorAll('.sos-status-item i').forEach(icon => {
        icon.setAttribute('data-original-class', icon.className);
    });

    function getGeoLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('Geolocation not supported');
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }),
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    }

    async function startAudioRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await uploadAudioEvidence(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
    }

    async function sendSosAlert(location) {
        const response = await fetch('/api/emergency/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location,
                timestamp: new Date().toISOString(),
                user: sessionStorage.getItem('tn_portal_user_name') || 'Anonymous'
            })
        });
        return response.json();
    }

    async function uploadAudioEvidence(blob) {
        const formData = new FormData();
        formData.append('audioFile', blob, 'sos_evidence.wav');
        formData.append('user', sessionStorage.getItem('tn_portal_user_name') || 'Anonymous');

        await fetch('/api/emergency/sos-audio', {
            method: 'POST',
            body: formData
        });
    }
});
