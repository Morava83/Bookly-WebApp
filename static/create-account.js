    (function () {
        var formStep    = document.getElementById('formStep');
        var verifyStep  = document.getElementById('verifyStep');
        var successStep = document.getElementById('successStep');

        var form         = document.getElementById('createAccountForm');
        var sendCodeBtn  = document.getElementById('sendCodeBtn');
        var formMsg      = document.getElementById('formMsg');

        var verifyBtn    = document.getElementById('verifyBtn');
        var verifyMsg    = document.getElementById('verifyMsg');
        var verifyCode   = document.getElementById('verifyCode');
        var emailDisplay = document.getElementById('verifyEmailDisplay');

        var resendBtn       = document.getElementById('resendBtn');
        var resendCountdown = document.getElementById('resendCountdown');

        var savedData = {};
        var resendTimer = null;

        function showFormMsg(text, type) {
            formMsg.textContent = text;
            formMsg.className = 'msg show ' + (type || 'error');
        }
        function showVerifyMsg(text, type) {
            verifyMsg.textContent = text;
            verifyMsg.className = 'msg show ' + (type || 'error');
        }
        function hideMsg(el) { el.className = 'msg'; el.textContent = ''; }

        /* ── STEP 1: Validate form and send code ── */

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideMsg(formMsg);

            var firstName = document.getElementById('firstName').value.trim();
            var lastName  = document.getElementById('lastName').value.trim();
            var email     = document.getElementById('createEmail').value.trim();
            var password  = document.getElementById('createPassword').value;
            var confirm   = document.getElementById('confirmPassword').value;

            if (!firstName || !lastName || !email || !password || !confirm) {
                showFormMsg('Please fill in all required fields.');
                return;
            }

            if (!document.getElementById('createEmail').checkValidity()) {
                showFormMsg('Please enter a valid email address.');
                return;
            }

            if (!/@(mcgill\.ca|mail\.mcgill\.ca)$/i.test(email)) {
                showFormMsg('Only McGill emails (@mcgill.ca or @mail.mcgill.ca) can register.');
                return;
            }

            if (password !== confirm) {
                showFormMsg('Passwords do not match.');
                return;
            }

            savedData = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                password: password
            };

            sendCodeBtn.disabled = true;
            sendCodeBtn.textContent = 'Sending code...';

            try {
                var res = await fetch('/api/send-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                var data = await res.json();

                if (!res.ok) {
                    showFormMsg(data.error || 'Could not send verification code.');
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.textContent = 'Send verification code';
                    return;
                }

                // Move to step 2
                formStep.style.display = 'none';
                verifyStep.classList.add('show');
                emailDisplay.textContent = email;
                verifyCode.value = '';
                verifyCode.focus();
                startResendTimer();

            } catch (err) {
                showFormMsg('Could not connect to the server.');
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = 'Send verification code';
            }
        });

        /* ── STEP 2: Verify code and register ── */

        verifyBtn.addEventListener('click', async function () {
            hideMsg(verifyMsg);

            var code = verifyCode.value.trim();
            if (!code || code.length !== 6) {
                showVerifyMsg('Please enter the 6-digit code.');
                return;
            }

            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Verifying...';

            try {
                var res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name: savedData.first_name,
                        last_name: savedData.last_name,
                        email: savedData.email,
                        password: savedData.password,
                        code: code
                    })
                });
                var data = await res.json();

                if (!res.ok) {
                    showVerifyMsg(data.error || 'Registration failed.');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Create account';
                    return;
                }

                // Move to step 3
                verifyStep.classList.remove('show');
                successStep.classList.add('show');
                clearInterval(resendTimer);

                // Redirect after 3 seconds
                setTimeout(function () {
                    window.location.href = '/';
                }, 3000);

            } catch (err) {
                showVerifyMsg('Could not connect to the server.');
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Create account';
            }
        });

        // Allow Enter key on code input
        verifyCode.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyBtn.click();
            }
        });

        /* ── Resend timer ── */

        function startResendTimer() {
            var seconds = 60;
            resendBtn.disabled = true;
            resendCountdown.textContent = 'Resend available in ' + seconds + 's';

            resendTimer = setInterval(function () {
                seconds--;
                if (seconds <= 0) {
                    clearInterval(resendTimer);
                    resendBtn.disabled = false;
                    resendCountdown.textContent = '';
                } else {
                    resendCountdown.textContent = 'Resend available in ' + seconds + 's';
                }
            }, 1000);
        }

        resendBtn.addEventListener('click', async function () {
            hideMsg(verifyMsg);
            resendBtn.disabled = true;

            try {
                var res = await fetch('/api/send-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: savedData.email })
                });
                var data = await res.json();

                if (!res.ok) {
                    showVerifyMsg(data.error || 'Could not resend code.');
                    resendBtn.disabled = false;
                    return;
                }

                showVerifyMsg('New code sent to ' + savedData.email + '.', 'success');
                startResendTimer();

            } catch (err) {
                showVerifyMsg('Could not connect to the server.');
                resendBtn.disabled = false;
            }
        });
    })();
