// Contributer
// Brian Morava - 261032388


(function () {
    var form = document.getElementById('loginForm');
    var requiredFields = form.querySelectorAll('[required]');
    var emailField = document.getElementById('email');
    var passwordField = document.getElementById('password');

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        var missingFields = [];
        var firstProblemField = null;

        for (var i = 0; i < requiredFields.length; i++) {
            var field = requiredFields[i];
            var value = field.value.trim();

            if (value === '') {
                missingFields.push(field.getAttribute('data-label'));
                if (!firstProblemField) {
                    firstProblemField = field;
                }
                continue;
            }

            if (field.type === 'email' && !field.checkValidity()) {
                missingFields.push('Valid Email');
                if (!firstProblemField) {
                    firstProblemField = field;
                }
            }
        }

        if (
            emailField.value.trim() !== '' &&
            emailField.checkValidity() &&
            !/@(mcgill\.ca|mail\.mcgill\.ca)$/i.test(emailField.value.trim())
        ) {
            missingFields.push('McGill Email');
            if (!firstProblemField) {
                firstProblemField = emailField;
            }
        }

        if (missingFields.length > 0) {
            alert(
                'Please complete all required fields before submitting.\n\n' +
                'Missing or invalid: ' + missingFields.join(', ')
            );

            if (firstProblemField) {
                firstProblemField.focus();
            }
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: emailField.value.trim(),
                    password: passwordField.value
                })
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.error || 'Login failed.');
                return;
            }

            window.location.href = result.redirect_url || "/home";

        } catch (error) {
            alert('Could not connect to the server.');
        }
    });
})();
