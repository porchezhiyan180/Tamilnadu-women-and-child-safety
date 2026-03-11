document.addEventListener('DOMContentLoaded', () => {

    // Check Authentication
    const isLoggedIn = sessionStorage.getItem('tn_portal_logged_in') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'login.html';
        return; // Stop execution if not authenticated
    }

    // Set Welcome Name
    const userName = sessionStorage.getItem('tn_portal_user_name') || 'User';
    document.getElementById('userNameDisplay').textContent = userName;

    // Load Complaints
    loadComplaints();

    // Load existing appointments
    loadAppointments();

    // Handle Counseling Booking
    const counselingForm = document.getElementById('counselingForm');
    if (counselingForm) {
        counselingForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const doctor = document.getElementById('doctorSelect').value;
            const date = document.getElementById('appointmentDate').value;
            const time = document.getElementById('appointmentTime').value;
            const mode = document.querySelector('input[name="sessionMode"]:checked').value;
            const btn = document.getElementById('bookSessionBtn');
            const feedback = document.getElementById('bookingFeedback');

            const token = sessionStorage.getItem('tn_portal_token');

            // Simulate booking request UI
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
            btn.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/appointments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        counselor: doctor,
                        date: date,
                        time: time,
                        mode: mode // The backend schema doesn't save mode currently, but we can pass it
                    })
                });

                const data = await response.json();

                btn.innerHTML = originalText;
                btn.disabled = false;

                if (!response.ok) {
                    feedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to book: ${data.error || 'Server error'}`;
                    feedback.className = 'feedback-msg error';
                    feedback.classList.remove('hidden');
                    return;
                }

                // Show success
                feedback.innerHTML = `<i class="fas fa-check-circle"></i> Appointment Confirmed! ID: APT-${data.id}`;
                feedback.className = 'feedback-msg success';
                feedback.classList.remove('hidden');

                // Reload list and reset form
                loadAppointments();
                counselingForm.reset();

                setTimeout(() => feedback.classList.add('hidden'), 5000);

            } catch (error) {
                console.error(error);
                btn.innerHTML = originalText;
                btn.disabled = false;
                feedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> Network error. Please try again.`;
                feedback.className = 'feedback-msg error';
                feedback.classList.remove('hidden');
            }
        });
    }

    // --- Helper Functions ---

    // We do not need extractEmailFromSession anymore as the backend identifies the user via JWT token.

    async function loadComplaints() {
        const tbody = document.getElementById('complaintsTableBody');
        const token = sessionStorage.getItem('tn_portal_token');

        if (!token) return;

        try {
            const response = await fetch('http://localhost:3000/api/user/complaints', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Unable to load complaints securely.</td></tr>';
                return;
            }

            const userComplaints = await response.json();

            tbody.innerHTML = ''; // Clear loading message

            if (userComplaints.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No complaints have been registered under your account yet.</td></tr>';
                return;
            }

            userComplaints.forEach(c => {
                const tr = document.createElement('tr');

                // Determine a mock visual status based on age for demo
                const submissionDate = new Date(c.submitted_at);
                const now = new Date();
                const daysOld = Math.floor((now - submissionDate) / (1000 * 60 * 60 * 24));

                let statusObj = { text: 'Under Review', class: 'status-review' };
                if (daysOld >= 3) {
                    statusObj = { text: 'Action Taken', class: 'status-action' };
                } else if (daysOld >= 1) {
                    statusObj = { text: 'Submitted', class: 'status-submitted' };
                }

                // Handle Evidence rendering
                let evidenceHtml = '<span style="color: #94a3b8; font-size: 0.85rem;">None</span>';
                if (c.evidence) {
                    try {
                        const files = JSON.parse(c.evidence);
                        if (Array.isArray(files) && files.length > 0) {
                            evidenceHtml = files.map(base64str => {
                                // Check if it's an image
                                if (base64str.startsWith('data:image')) {
                                    return `<img src="${base64str}" alt="Evidence" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; cursor: pointer; margin-right: 5px;" onclick="window.open('${base64str}', '_blank')">`;
                                } else {
                                    return `<span style="display:inline-block; background:#e2e8f0; padding:4px 8px; border-radius:4px; font-size:0.8rem; margin-right:5px;"><i class="fas fa-paperclip"></i> File</span>`;
                                }
                            }).join('');
                        } else {
                            evidenceHtml = `<span style="font-size: 0.85rem;">${c.evidence}</span>`; // old format fallback
                        }
                    } catch (e) {
                        // Fallback if not JSON (e.g. old data or just a file name string)
                        evidenceHtml = `<span style="font-size: 0.85rem; word-break: break-all;">${c.evidence}</span>`;
                    }
                }

                tr.innerHTML = `
                    <td><strong>${c.tracking_id}</strong></td>
                    <td>${c.date}</td>
                    <td>${c.location}</td>
                    <td><span class="status-badge ${statusObj.class}">${statusObj.text}</span></td>
                    <td>${evidenceHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Network error loading complaints.</td></tr>';
        }
    }

    async function loadAppointments() {
        const list = document.getElementById('appointmentsList');
        const token = sessionStorage.getItem('tn_portal_token');

        if (!token) return;

        try {
            const response = await fetch('http://localhost:3000/api/user/appointments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                list.innerHTML = '<li class="empty-state" style="padding: 10px; color: var(--danger);">Unable to load appointments securely.</li>';
                return;
            }

            const userApts = await response.json();

            if (userApts.length === 0) {
                list.innerHTML = '<li class="empty-state" style="padding: 10px;">No upcoming sessions scheduled.</li>';
                return;
            }

            list.innerHTML = '';
            userApts.forEach(a => {
                const li = document.createElement('li');
                li.className = 'appointment-item';

                // Format nice date
                const dateObj = new Date(a.date);
                const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                li.innerHTML = `
                    <div class="doc-name"><i class="fas fa-user-md"></i> ${a.counselor}</div>
                    <div class="time-slot">
                        <i class="far fa-calendar-alt"></i> ${formattedDate} at ${a.time} 
                        <span style="margin-left:auto; background: #e0e7ff; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; color: #3730a3;"><i class="fas fa-video"></i> Consult</span>
                    </div>
                `;
                list.appendChild(li);
            });
        } catch (error) {
            console.error(error);
            list.innerHTML = '<li class="empty-state" style="padding: 10px; color: var(--danger);">Network error loading appointments.</li>';
        }
    }
});
