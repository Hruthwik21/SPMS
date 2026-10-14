document.addEventListener('DOMContentLoaded', async () => {
    if (!API.isLoggedIn()) { window.location.href = '/login.html'; return; }

    const deptBadge = document.getElementById('userDept');
    if (deptBadge && API.user) deptBadge.textContent = API.user.department === 'ALL' ? 'Admin' : API.user.department;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        API.clearAuth();
        window.location.href = '/login.html';
    });

    document.getElementById('searchStudentBtn').addEventListener('click', searchStudent);
    document.getElementById('rollNoInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStudent();
    });

    await loadGpaTable();
    await loadSgpaCgpaChart();
    await loadCourseSelect();
});

async function searchStudent() {
    const rollNo = document.getElementById('rollNoInput').value.trim();
    if (!rollNo) return;

    try {
        const data = await API.get(`/sgpa_cgpa?roll_no=${encodeURIComponent(rollNo)}`);
        const info = document.getElementById('studentInfo');

        if (!data.length) {
            info.innerHTML = '<p style="color:var(--text-muted);">No GPA data found for this student.</p>';
            info.style.display = 'block';
            return;
        }

        const latest = data[data.length - 1];
        info.innerHTML = `
            <div class="student-info-item"><span class="label">Roll No</span><span class="value">${latest.roll_no}</span></div>
            <div class="student-info-item"><span class="label">Latest SGPA</span><span class="value">${latest.sgpa || '-'}</span></div>
            <div class="student-info-item"><span class="label">Latest CGPA</span><span class="value">${latest.cgpa || '-'}</span></div>
        `;
        info.style.display = 'flex';

        new Chart(document.getElementById('gpaTrendChart'), {
            type: 'line',
            data: {
                labels: data.map(d => `Sem ${d.semester}`),
                datasets: [
                    { label: 'SGPA', data: data.map(d => d.sgpa), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4 },
                    { label: 'CGPA', data: data.map(d => d.cgpa), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 10, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } },
            },
        });
    } catch (err) {
        console.error('Failed to search student:', err);
    }
}

async function loadGpaTable() {
    try {
        const data = await API.get('/sgpa_cgpa');
        const tbody = document.getElementById('gpaTbody');
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No data available</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(d => `
            <tr>
                <td>${d.roll_no}</td>
                <td>${d.name}</td>
                <td>${d.department}</td>
                <td>Sem ${d.semester}</td>
                <td><strong>${d.sgpa || '-'}</strong></td>
                <td><strong>${d.cgpa || '-'}</strong></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load GPA table:', err);
    }
}

async function loadSgpaCgpaChart() {
    try {
        const data = await API.get('/sgpa_cgpa');
        if (!data.length) return;

        new Chart(document.getElementById('sgpaCgpaChart'), {
            type: 'bar',
            data: {
                labels: data.map(d => `${d.roll_no}`),
                datasets: [
                    { label: 'SGPA', data: data.map(d => d.sgpa), backgroundColor: '#6366f1', borderRadius: 4 },
                    { label: 'CGPA', data: data.map(d => d.cgpa), backgroundColor: '#10b981', borderRadius: 4 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 10, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } },
            },
        });
    } catch (err) {
        console.error('Failed to load SGPA/CGPA chart:', err);
    }
}

async function loadCourseSelect() {
    try {
        const courses = await API.get('/courses');
        const select = document.getElementById('courseSelect');
        select.innerHTML = courses.map(c => `<option value="${c.course_code}">${c.course_code} - ${c.course_name}</option>`).join('');
        select.addEventListener('change', () => loadCoursePerformance(select.value));
        if (courses.length) await loadCoursePerformance(courses[0].course_code);
    } catch (err) {
        console.error('Failed to load courses:', err);
    }
}

async function loadCoursePerformance(courseCode) {
    try {
        const data = await API.get(`/course_performance?course_code=${encodeURIComponent(courseCode)}`);
        const stats = document.getElementById('courseStats');
        stats.innerHTML = `
            <div class="course-stat"><div class="num">${data.total_students}</div><div class="lbl">Students</div></div>
            <div class="course-stat"><div class="num" style="color:var(--success)">${data.pass_percentage}%</div><div class="lbl">Pass Rate</div></div>
            <div class="course-stat"><div class="num">${data.average_grade_points}</div><div class="lbl">Avg Points</div></div>
        `;
        stats.style.display = 'flex';

        const grades = Object.keys(data.grade_distribution);
        const counts = Object.values(data.grade_distribution);
        new Chart(document.getElementById('gradeDistChart'), {
            type: 'bar',
            data: {
                labels: grades,
                datasets: [{ data: counts, backgroundColor: '#8b5cf6', borderRadius: 6 }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                },
                plugins: { legend: { display: false } },
            },
        });
    } catch (err) {
        console.error('Failed to load course performance:', err);
    }
}
