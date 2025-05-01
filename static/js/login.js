document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Clear previous messages
        loginMessage.textContent = '';
        loginMessage.classList.remove('error', 'success');
        
        // Basic validation
        if (!username || !password) {
            showMessage('Please enter both username and password', 'error');
            return;
        }
        
        // Send login request
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                // Login successful
                showMessage('Login successful! Redirecting...', 'success');
                
                // Store token and user info
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('department', data.department);
                
                // Redirect to performance page
                setTimeout(() => {
                    window.location.href = 'perf1.html';
                }, 1000);
            } else {
                // Login failed
                showMessage(data.message || 'Login failed. Please check your credentials.', 'error');
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            showMessage('An error occurred during login. Please try again.', 'error');
        });
    });

    // Function to show messages
    function showMessage(text, type) {
        loginMessage.textContent = text;
        loginMessage.classList.add(type);
        loginMessage.style.display = 'block';
    }
});