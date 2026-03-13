document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('complaintForm');
    const anonymousCheckbox = document.getElementById('anonymous');
    const fullNameInput = document.getElementById('fullName');
    const contactInput = document.getElementById('contactNumber');
    const emailInput = document.getElementById('email');
    const submitBtn = document.getElementById('submitBtn');
    const feedbackMsg = document.getElementById('formFeedback');

    // Handle Dynamic Header Actions (Phase 16)
    const publicActions = document.getElementById('publicActions');
    const privateActions = document.getElementById('privateActions');
    const isLoggedIn = sessionStorage.getItem('tn_portal_logged_in') === 'true';

    // Set visibility initially on page load
    if (publicActions && privateActions) {
        if (isLoggedIn) {
            publicActions.classList.add('hidden');
            privateActions.classList.remove('hidden');
        } else {
            publicActions.classList.remove('hidden');
            privateActions.classList.add('hidden');
        }
    }

    // Handle Anonymous Checkbox Toggle
    if (anonymousCheckbox) {
        anonymousCheckbox.addEventListener('change', function () {
            if (this.checked) {
                // If anonymous, make name/contact optional and disable them or fill with placeholder
                fullNameInput.value = 'Anonymous User';
                fullNameInput.readOnly = true;
                contactInput.value = '0000000000';
                contactInput.readOnly = true;
                emailInput.value = '';
                emailInput.disabled = true;

                // Add a visual indicator
                fullNameInput.style.backgroundColor = '#e2e8f0';
                contactInput.style.backgroundColor = '#e2e8f0';
                emailInput.style.backgroundColor = '#e2e8f0';
            } else {
                // Restore normal state
                fullNameInput.value = '';
                fullNameInput.readOnly = false;
                contactInput.value = '';
                contactInput.readOnly = false;
                emailInput.disabled = false;

                fullNameInput.style.backgroundColor = '';
                contactInput.style.backgroundColor = '';
                emailInput.style.backgroundColor = '';
            }
        });
    }

    // Handle Form Submission
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting... (சமர்ப்பிக்கிறது...)';
            submitBtn.disabled = true;

            const date = document.getElementById('incidentDate').value;
            const districtElement = document.getElementById('district');
            const locationText = districtElement.options[districtElement.selectedIndex]?.text || '';
            const locationDetails = document.getElementById('locationDetails')?.value || '';
            // For complaint type, grab checkboxes or use general
            const type = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.parentNode.textContent.trim()).join(', ') || 'General Complaint';

            // The main description text area
            const descriptionInput = document.getElementById('description');
            const description = descriptionInput ? descriptionInput.value : '';

            // Handle Evidence & Form Data
            const evidenceInput = document.getElementById('evidence');
            const formData = new FormData();

            formData.append('type', type);
            formData.append('location', locationText + (locationDetails ? ', ' + locationDetails : ''));
            formData.append('date', date);
            formData.append('description', description);

            if (evidenceInput && evidenceInput.files.length > 0) {
                Array.from(evidenceInput.files).forEach(file => {
                    formData.append('evidenceFiles', file); // Append actual files
                });
            }

            const currentName = sessionStorage.getItem('tn_portal_user_name');
            const token = sessionStorage.getItem('tn_portal_token');

            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                // Note: Do NOT set Content-Type header when using FormData; the browser sets it with the boundary boundary string automatically.
            }

            try {
                const response = await fetch('/api/complaints', {
                    method: 'POST',
                    headers: headers,
                    body: formData // Send the raw file data
                });

                const data = await response.json();

                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;

                if (!response.ok) {
                    feedbackMsg.classList.remove('hidden', 'success');
                    feedbackMsg.classList.add('error');
                    feedbackMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to submit complaint. ' + (data.error || 'Please try again.');
                    return;
                }

                form.reset();

                if (anonymousCheckbox.checked) {
                    anonymousCheckbox.checked = false;
                    anonymousCheckbox.dispatchEvent(new Event('change'));
                }

                feedbackMsg.classList.remove('hidden', 'error');
                feedbackMsg.classList.add('success');
                feedbackMsg.innerHTML = `
                    <i class="fas fa-check-circle"></i> 
                    <strong>Complaint Registered Successfully!</strong><br>
                    (புகார் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது!)<br>
                    Your Reference ID is: <strong>${data.tracking_id}</strong>.<br>
                    Please save this ID for future tracking. Or view it in your <a href="dashboard.html" style="text-decoration: underline; font-weight: bold;">Dashboard</a>.
                `;

                feedbackMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {
                    feedbackMsg.classList.add('hidden');
                }, 10000);

            } catch (error) {
                console.error(error);
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                feedbackMsg.classList.remove('hidden', 'success');
                feedbackMsg.classList.add('error');
                feedbackMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Network error. Please try again.';
            }
        });
    }

    // --- PUBLIC CASE TRACKING LOGIC --- //
    const trackForm = document.getElementById('publicTrackForm');
    const trackRefIdInput = document.getElementById('trackRefId');
    const trackResultArea = document.getElementById('trackResultArea');

    if (trackForm) {
        trackForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const refId = trackRefIdInput.value.trim();

            if (!refId) return;

            trackResultArea.classList.remove('hidden');
            trackResultArea.innerHTML = `<div style="text-align:center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Searching database...</div>`;

            try {
                const response = await fetch(`/api/complaints/${refId}`);

                if (!response.ok) {
                    // Complaint not found
                    trackResultArea.innerHTML = `
                        <div style="text-align: center; color: var(--danger); padding: 10px;">
                            <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                            <h4 style="margin-bottom: 5px;">Record Not Found</h4>
                            <p style="font-size: 0.9rem;">We could not find a complaint matching Reference ID: <strong>${refId}</strong>.</p>
                            <p style="font-size: 0.85rem; color: var(--text-light); margin-top: 10px;">Please check the ID and try again, or <a href="login.html" style="color: var(--primary-color); text-decoration: underline;">Login</a> to view details.</p>
                        </div>
                    `;
                    return;
                }

                const data = await response.json();

                // Determine a mock status based on date for realism
                const submissionDate = new Date(data.submitted_at);
                const now = new Date();
                const daysOld = Math.floor((now - submissionDate) / (1000 * 60 * 60 * 24));

                let statusHtml, statusText;
                if (daysOld < 1) {
                    statusHtml = `<span class="status-badge status-review" style="font-size: 1rem;"><i class="fas fa-clock"></i> Under Review (பரிசீலனையில்)</span>`;
                    statusText = "Your complaint has been received and is currently being reviewed by the designated officer.";
                } else if (daysOld < 3) {
                    statusHtml = `<span class="status-badge status-submitted" style="font-size: 1rem; background: #e0f2fe; color: #0284c7;"><i class="fas fa-user-shield"></i> Assigned to Inspector (அதிகாரியிடம் ஒப்படைக்கப்பட்டது)</span>`;
                    statusText = "Your case has been assigned to the local station inspector for preliminary investigation.";
                } else {
                    statusHtml = `<span class="status-badge status-action" style="font-size: 1rem;"><i class="fas fa-check-circle"></i> Action Initiated (நடவடிக்கை எடுக்கப்பட்டது)</span>`;
                    statusText = "Initial action has been initiated. You will be contacted shortly on your registered number.";
                }

                trackResultArea.innerHTML = `
                    <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 15px;">
                        <span style="font-size: 0.85rem; color: var(--text-light); text-transform: uppercase; font-weight: bold;">Reference ID</span>
                        <h4 style="font-size: 1.2rem; color: var(--text-color); margin-top: 5px;">${data.tracking_id}</h4>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <span style="font-size: 0.85rem; color: var(--text-light); text-transform: uppercase; font-weight: bold;">Current Status</span>
                        <div style="margin-top: 8px;">${statusHtml}</div>
                    </div>
                    <p style="font-size: 0.95rem; color: var(--text-color); line-height: 1.5; background: white; padding: 15px; border-radius: 4px; border-left: 3px solid var(--secondary-color);">
                        ${statusText}
                        <br><br>
                        <span style="font-size: 0.85rem; color: var(--text-light);">Submitted: ${new Date(data.submitted_at).toLocaleDateString()}</span>
                    </p>
                `;

            } catch (error) {
                console.error(error);
                trackResultArea.innerHTML = `
                    <div style="text-align: center; color: var(--danger); padding: 10px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <h4 style="margin-bottom: 5px;">Network Error</h4>
                        <p style="font-size: 0.9rem;">Unable to connect to the server. Please try again later.</p>
                    </div>
                `;
            }
        });
    }

});
