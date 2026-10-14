document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const btn = document.getElementById('loginBtn');

    if (API.isLoggedIn()) {
        window.location.href = '/dashboard.html';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.querySelector('.btn-spinner').style.display = 'inline-block';
        btn.querySelector('span:first-child').textContent = 'Signing in...';

        try {
            const data = await API.post('/login', {
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value,
            });
            API.setAuth(data.token, data.user);
            showAlert('Login successful! Redirecting...', 'success');
            setTimeout(() => { window.location.href = '/dashboard.html'; }, 500);
        } catch (err) {
            showAlert(err.message);
        } finally {
            btn.disabled = false;
            btn.querySelector('.btn-spinner').style.display = 'none';
            btn.querySelector('span:first-child').textContent = 'Sign In';
        }
    });
});
