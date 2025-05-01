document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (token && userInfo) {
        // Redirect to main page if already logged in
        window.location.href = 'perf1.html';
        return;
    }
    
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous messages
        loginMessage.className = 'message';
        loginMessage.style.display = 'none';
        loginMessage.textContent = '';
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            showMessage('Please enter both username and password.', 'error');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                showMessage(data.message || 'Login failed. Please check your credentials.', 'error');
                return;
            }
            
            // Store token and user info in local storage
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_info', JSON.stringify({
                username: data.username,
                department: data.department
            }));
            
            // Redirect to main page
            window.location.href = 'perf1.html';
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Server error. Please try again later.', 'error');
        }
    });
    
    function showMessage(text, type) {
        loginMessage.textContent = text;
        loginMessage.className = `message ${type}`;
        loginMessage.style.display = 'block';
    }
});
