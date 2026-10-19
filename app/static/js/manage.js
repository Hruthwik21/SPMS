let students = [];
let courses = [];
let marks = [];
let grades = [];
let enrollRowCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (!API.isLoggedIn()) { window.location.href = '/login.html'; return; }

    const deptBadge = document.getElementById('userDept');
    if (deptBadge && API.user) deptBadge.textContent = API.user.department === 'ALL' ? 'Admin' : API.user.department;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        API.clearAuth();
        window.location.href = '/login.html';
    });

    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('studentFilter').addEventListener('input', renderStudents);
    document.getElementById('addCourseRow').addEventListener('click', addEnrollRow);
    document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
    document.getElementById('modalForm').addEventListener('submit', handleModalSubmit);

    loadAll();
});

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

async function loadAll() {
    try {
        [students, courses, marks, grades] = await Promise.all([
            API.get('/students'),
            API.get('/courses'),
            API.get('/marks'),
            API.get('/student_details'),
        ]);
        renderStudents();
        renderCourses();
        renderRecords();
        addEnrollRow();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function courseOptions() {
    return '<option value="">Select...</option>' + courses.map(c =>
        `<option value="${c.course_code}">${c.course_code} - ${c.course_name} (${c.credits}cr)</option>`
    ).join('');
}

function gradeOptions() {
    return '<option value="">--</option>' +
        ['EX', 'A', 'B', 'C', 'D', 'E', 'P', 'F', 'R'].map(g =>
            `<option value="${g}">${g}</option>`
        ).join('');
}

function addEnrollRow() {
    enrollRowCount++;
    const tbody = document.getElementById('enrollTbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><select class="input-sm en-course" required>${courseOptions()}</select></td>
        <td><input type="number" class="input-sm en-sem" min="1" max="8" placeholder="Sem" required style="width:60px"></td>
        <td><select class="input-sm en-grade" required>${gradeOptions()}</select></td>
        <td><input type="number" class="input-sm en-m1" min="0" max="20" step="0.5" placeholder="20" style="width:60px"></td>
        <td><input type="number" class="input-sm en-mid" min="0" max="30" step="0.5" placeholder="30" style="width:60px"></td>
        <td><input type="number" class="input-sm en-m2" min="0" max="20" step="0.5" placeholder="20" style="width:60px"></td>
        <td><input type="number" class="input-sm en-end" min="0" max="50" step="0.5" placeholder="50" style="width:60px"></td>
        <td><button type="button" class="btn btn-ghost btn-sm btn-danger" onclick="this.closest('tr').remove()">X</button></td>
    `;
    tbody.appendChild(tr);
}

async function handleProfileSubmit(e) {
    e.preventDefault();

    const rollNo = document.getElementById('pf_roll_no').value.trim();
    const name = document.getElementById('pf_name').value.trim();
    const dept = document.getElementById('pf_dept').value;
    const year = document.getElementById('pf_year').value.trim();

    const rows = document.querySelectorAll('#enrollTbody tr');
    if (!rows.length) { showToast('Add at least one course', 'error'); return; }

    const enrollments = [];
    for (const row of rows) {
        const course_code = row.querySelector('.en-course').value;
        const semester = row.querySelector('.en-sem').value;
        const grade = row.querySelector('.en-grade').value;
        const minor_1 = row.querySelector('.en-m1').value || null;
        const mid = row.querySelector('.en-mid').value || null;
        const minor_2 = row.querySelector('.en-m2').value || null;
        const endsem = row.querySelector('.en-end').value || null;

        if (!course_code || !semester || !grade) {
            showToast('Fill course, semester, and grade for every row', 'error');
            return;
        }
        enrollments.push({ course_code, semester: parseInt(semester), grade, minor_1, mid, minor_2, endsem });
    }

    const btn = document.getElementById('submitProfile');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const existing = students.find(s => s.rollNo === rollNo);
        if (existing) {
            await API.put(`/students/${rollNo}`, { name, department: dept });
        } else {
            await API.post('/students', { roll_no: rollNo, name, department: dept });
        }

        for (const e of enrollments) {
            await API.post('/student_details', {
                roll_no: rollNo,
                course_code: e.course_code,
                semester: e.semester,
                academic_year: year,
                grade: e.grade,
            });
            await API.post('/marks', {
                roll_no: rollNo,
                course_code: e.course_code,
                minor_1: e.minor_1 ? parseFloat(e.minor_1) : null,
                mid: e.mid ? parseFloat(e.mid) : null,
                minor_2: e.minor_2 ? parseFloat(e.minor_2) : null,
                endsem: e.endsem ? parseFloat(e.endsem) : null,
            });
        }

        showToast(`Student ${rollNo} profile created with ${enrollments.length} course(s)`);
        e.target.reset();
        document.getElementById('enrollTbody').innerHTML = '';
        addEnrollRow();
        await loadAll();
        switchTab('students');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Student Profile';
    }
}

function renderStudents() {
    const filter = document.getElementById('studentFilter').value.toLowerCase();
    const filtered = students.filter(s =>
        s.rollNo.toLowerCase().includes(filter) ||
        s.name.toLowerCase().includes(filter) ||
        s.department.toLowerCase().includes(filter)
    );
    const tbody = document.getElementById('studentsTbody');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No students found</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>${s.rollNo}</td>
            <td>${s.name}</td>
            <td>${s.department}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="deleteStudent('${s.rollNo}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderCourses() {
    const tbody = document.getElementById('coursesTbody');
    if (!courses.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No courses found</td></tr>';
        return;
    }
    tbody.innerHTML = courses.map((c, i) => `
        <tr>
            <td>${c.course_code}</td>
            <td>${c.course_name}</td>
            <td>${c.credits}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="editCourse(${i})">Edit</button>
                <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteCourse(${c.course_code})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderRecords() {
    const filter = document.getElementById('recordFilter').value;
    const tbody = document.getElementById('recordsTbody');
    const markMap = {};
    marks.forEach(m => { markMap[`${m.roll_no}_${m.course_code}`] = m; });

    let rows = grades.map(g => {
        const m = markMap[`${g.roll_no}_${g.course_code}`] || {};
        return { ...g, name: m.name || g.name, m1: m.minor_1, mid: m.mid, m2: m.minor_2, end: m.endsem };
    });

    if (filter === 'marks') rows = rows.filter(r => r.m1 != null || r.mid != null || r.m2 != null || r.end != null);
    if (filter === 'grades') rows = rows.filter(r => r.grade);

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">No records found</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${r.roll_no}</td>
            <td>${r.name || '-'}</td>
            <td>${r.course_code}</td>
            <td>${r.semester}</td>
            <td>${r.academic_year}</td>
            <td>${gradeBadge(r.grade)}</td>
            <td>${r.m1 ?? '-'}</td>
            <td>${r.mid ?? '-'}</td>
            <td>${r.m2 ?? '-'}</td>
            <td>${r.end ?? '-'}</td>
        </tr>
    `).join('');
}

async function deleteStudent(rollNo) {
    if (!confirm(`Delete student ${rollNo}? All their data will be removed.`)) return;
    try {
        await API.delete(`/students/${rollNo}`);
        showToast('Student deleted');
        await loadAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openCourseModal() {
    document.getElementById('modalTitle').textContent = 'Add Course';
    document.getElementById('modalForm').innerHTML = `
        <div class="form-group"><label>Course Code</label>
            <input type="text" name="course_code" required placeholder="e.g. CS301"></div>
        <div class="form-group"><label>Course Name</label>
            <input type="text" name="course_name" required placeholder="e.g. Machine Learning"></div>
        <div class="form-group"><label>Credits</label>
            <input type="number" name="credits" min="1" max="10" required></div>
        <button type="submit" class="btn btn-primary btn-block">Add Course</button>
    `;
    document.getElementById('modalForm').dataset.type = 'course';
    document.getElementById('modalOverlay').classList.add('active');
}

function editCourse(index) {
    const c = courses[index];
    document.getElementById('modalTitle').textContent = 'Edit Course';
    document.getElementById('modalForm').innerHTML = `
        <div class="form-group"><label>Course Code</label>
            <input type="text" name="course_code" value="${c.course_code}" readonly></div>
        <div class="form-group"><label>Course Name</label>
            <input type="text" name="course_name" value="${c.course_name}" required></div>
        <div class="form-group"><label>Credits</label>
            <input type="number" name="credits" min="1" max="10" value="${c.credits}" required></div>
        <button type="submit" class="btn btn-primary btn-block">Update Course</button>
    `;
    document.getElementById('modalForm').dataset.type = 'course-edit';
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

async function handleModalSubmit(e) {
    e.preventDefault();
    const type = e.target.dataset.type;
    const data = Object.fromEntries(new FormData(e.target).entries());

    try {
        if (type === 'course') {
            await API.post('/courses', data);
            showToast('Course added');
        } else if (type === 'course-edit') {
            await API.put(`/courses/${data.course_code}`, data);
            showToast('Course updated');
        }
        closeModal();
        await loadAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCourse(code) {
    if (!confirm(`Delete course ${code}?`)) return;
    try {
        await API.delete(`/courses/${code}`);
        showToast('Course deleted');
        await loadAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}
