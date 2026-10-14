const API = {
    token: localStorage.getItem('spms_token'),
    user: JSON.parse(localStorage.getItem('spms_user') || 'null'),

    async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        };
        if (this.token) config.headers['Authorization'] = `Bearer ${this.token}`;
        if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);

        const res = await fetch(url, config);
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            this.clearAuth();
            if (!window.location.pathname.includes('login')) window.location.href = '/login.html';
            throw new Error(data.message || 'Unauthorized');
        }

        if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
        return data;
    },

    get(endpoint) { return this.request(endpoint); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('spms_token', token);
        localStorage.setItem('spms_user', JSON.stringify(user));
    },

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('spms_token');
        localStorage.removeItem('spms_user');
    },

    isLoggedIn() { return !!this.token; }
};

function showAlert(message, type = 'error') {
    const el = document.getElementById('loginMessage');
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.style.display = 'block';
}

function gradeBadge(grade) {
    if (!grade) return '<span class="grade-badge">-</span>';
    const cls = grade.toLowerCase().startsWith('ex') ? 'grade-ex'
        : grade.toLowerCase() === 'a' ? 'grade-a'
        : grade.toLowerCase() === 'b' ? 'grade-b'
        : grade.toLowerCase() === 'c' ? 'grade-c'
        : 'grade-f';
    return `<span class="grade-badge ${cls}">${grade}</span>`;
}
