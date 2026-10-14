document.addEventListener('DOMContentLoaded', async () => {
    if (!API.isLoggedIn()) { window.location.href = '/login.html'; return; }

    const deptBadge = document.getElementById('userDept');
    if (deptBadge && API.user) deptBadge.textContent = API.user.department === 'ALL' ? 'Admin' : API.user.department;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        API.clearAuth();
        window.location.href = '/login.html';
    });

    await loadSummary();
    await loadCharts();
    await loadRecentEntries();
});

async function loadSummary() {
    try {
        const data = await API.get('/dashboard_summary');
        const grid = document.getElementById('statsGrid');
        const cards = [
            { icon: 'indigo', label: 'Total Students', value: data.total_students },
            { icon: 'emerald', label: 'Active Courses', value: data.total_courses },
            { icon: 'amber', label: 'Mark Entries', value: data.total_marks },
            { icon: 'rose', label: 'Departments', value: Object.keys(data.department_counts).length },
        ];
        grid.innerHTML = cards.map(c => `
            <div class="stat-card">
                <div class="stat-icon ${c.icon}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div class="stat-value">${c.value}</div>
                <div class="stat-label">${c.label}</div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load summary:', err);
    }
}

async function loadCharts() {
    try {
        const [passStats, cgpaStats] = await Promise.all([
            API.get('/pass_stats'),
            API.get('/cgpa_stats'),
        ]);

        new Chart(document.getElementById('deptChart'), {
            type: 'doughnut',
            data: {
                labels: passStats.map(d => d.department),
                datasets: [{
                    data: passStats.map(d => d.total),
                    backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'],
                    borderWidth: 0,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
            },
        });

        new Chart(document.getElementById('passChart'), {
            type: 'bar',
            data: {
                labels: passStats.map(d => d.department),
                datasets: [{
                    label: 'Pass %',
                    data: passStats.map(d => d.passPercentage),
                    backgroundColor: '#6366f1',
                    borderRadius: 6,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                },
                plugins: { legend: { display: false } },
            },
        });

        const labels = cgpaStats.map(d => d.department);
        new Chart(document.getElementById('cgpaChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Average', data: cgpaStats.map(d => d.avg), backgroundColor: '#6366f1', borderRadius: 6 },
                    { label: 'Max', data: cgpaStats.map(d => d.max), backgroundColor: '#10b981', borderRadius: 6 },
                    { label: 'Min', data: cgpaStats.map(d => d.min), backgroundColor: '#f59e0b', borderRadius: 6 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } },
            },
        });
    } catch (err) {
        console.error('Failed to load charts:', err);
    }
}

async function loadRecentEntries() {
    try {
        const data = await API.get('/dashboard_summary');
        const tbody = document.getElementById('recentTbody');
        if (!data.recent_entries.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No recent entries</td></tr>';
            return;
        }
        tbody.innerHTML = data.recent_entries.map(e => `
            <tr>
                <td>${e.roll_no}</td>
                <td>${e.name}</td>
                <td>${e.course_code}</td>
                <td>Sem ${e.semester}</td>
                <td>${gradeBadge(e.grade)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load recent entries:', err);
    }
}
