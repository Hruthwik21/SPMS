let students = [];
let courses = [];
let marks = [];
let grades = [];
let editMode = false;
let editId = null;

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
    document.getElementById('modalForm').addEventListener('submit', handleFormSubmit);

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
        renderMarks();
        renderGrades();
        renderCourses();
    } catch (err) {
        showToast(err.message, 'error');
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
                <button class="btn btn-ghost btn-sm" onclick="editStudent('${s.rollNo}')">Edit</button>
                <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteStudent('${s.rollNo}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderMarks() {
    const tbody = document.getElementById('marksTbody');
    if (!marks.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No marks found</td></tr>';
        return;
    }
    tbody.innerHTML = marks.map((m, i) => `
        <tr>
            <td>${m.roll_no}</td>
            <td>${m.course_code}</td>
            <td>${m.minor_1 ?? '-'}</td>
            <td>${m.mid ?? '-'}</td>
            <td>${m.minor_2 ?? '-'}</td>
            <td>${m.endsem ?? '-'}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="editMark(${i})">Edit</button>
                <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteMark(${i})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderGrades() {
    const tbody = document.getElementById('gradesTbody');
    if (!grades.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No grades found</td></tr>';
        return;
    }
    tbody.innerHTML = grades.map((g, i) => `
        <tr>
            <td>${g.roll_no}</td>
            <td>${g.name}</td>
            <td>${g.course_code}</td>
            <td>Sem ${g.semester}</td>
            <td>${g.academic_year}</td>
            <td>${gradeBadge(g.grade)}</td>
            <td>
                <button class="btn btn-ghost btn-sm" onclick="editGrade(${i})">Edit</button>
                <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteGrade(${i})">Delete</button>
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
                <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteCourse(${i})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openModal(type, data = null) {
    editMode = !!data;
    editId = data ? data.id || data.roll_no : null;

    const overlay = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('modalForm');

    const studentOptions = students.map(s => `<option value="${s.roll_no}">${s.roll_no} - ${s.name}</option>`).join('');
    const courseOptions = courses.map(c => `<option value="${c.course_code}">${c.course_code} - ${c.course_name}</option>`).join('');

    switch (type) {
        case 'student':
            title.textContent = editMode ? 'Edit Student' : 'Add Student';
            form.innerHTML = `
                <div class="form-group"><label>Roll No</label>
                    <input type="text" name="roll_no" value="${data?.rollNo || ''}" ${editMode ? 'readonly' : 'required'}></div>
                <div class="form-group"><label>Name</label>
                    <input type="text" name="name" value="${data?.name || ''}" required></div>
                <div class="form-group"><label>Department</label>
                    <select name="department" required>
                        <option value="">Select...</option>
                        <option value="CSE" ${data?.department === 'CSE' ? 'selected' : ''}>CSE</option>
                        <option value="ME" ${data?.department === 'ME' ? 'selected' : ''}>ME</option>
                        <option value="EE" ${data?.department === 'EE' ? 'selected' : ''}>EE</option>
                    </select></div>
                <button type="submit" class="btn btn-primary btn-block">${editMode ? 'Update' : 'Add'} Student</button>
            `;
            form.dataset.type = 'student';
            break;

        case 'mark':
            title.textContent = editMode ? 'Edit Marks' : 'Add Marks';
            form.innerHTML = `
                <div class="form-group"><label>Student</label>
                    <select name="roll_no" ${editMode ? 'readonly' : 'required'}>${studentOptions}</select></div>
                <div class="form-group"><label>Course</label>
                    <select name="course_code" ${editMode ? 'readonly' : 'required'}>${courseOptions}</select></div>
                <div class="form-group"><label>Minor-1 (out of 20)</label>
                    <input type="number" name="minor_1" min="0" max="20" step="0.5" value="${data?.minor_1 ?? ''}"></div>
                <div class="form-group"><label>Mid (out of 30)</label>
                    <input type="number" name="mid" min="0" max="30" step="0.5" value="${data?.mid ?? ''}"></div>
                <div class="form-group"><label>Minor-2 (out of 20)</label>
                    <input type="number" name="minor_2" min="0" max="20" step="0.5" value="${data?.minor_2 ?? ''}"></div>
                <div class="form-group"><label>End Sem (out of 50)</label>
                    <input type="number" name="endsem" min="0" max="50" step="0.5" value="${data?.endsem ?? ''}"></div>
                <button type="submit" class="btn btn-primary btn-block">${editMode ? 'Update' : 'Add'} Marks</button>
            `;
            if (editMode && data) {
                form.querySelector(`select[name="roll_no"]`).value = data.roll_no;
                form.querySelector(`select[name="course_code"]`).value = data.course_code;
            }
            form.dataset.type = 'mark';
            break;

        case 'grade':
            title.textContent = editMode ? 'Edit Grade' : 'Add Grade';
            form.innerHTML = `
                <div class="form-group"><label>Student</label>
                    <select name="roll_no" ${editMode ? 'readonly' : 'required'}>${studentOptions}</select></div>
                <div class="form-group"><label>Course</label>
                    <select name="course_code" ${editMode ? 'readonly' : 'required'}>${courseOptions}</select></div>
                <div class="form-group"><label>Semester</label>
                    <input type="number" name="semester" min="1" max="8" value="${data?.semester || ''}" required></div>
                <div class="form-group"><label>Academic Year</label>
                    <input type="text" name="academic_year" placeholder="e.g. 2024-25" value="${data?.academic_year || ''}" required></div>
                <div class="form-group"><label>Grade</label>
                    <select name="grade" required>
                        <option value="">Select...</option>
                        <option value="EX" ${data?.grade === 'EX' ? 'selected' : ''}>EX (10)</option>
                        <option value="A" ${data?.grade === 'A' ? 'selected' : ''}>A (9)</option>
                        <option value="B" ${data?.grade === 'B' ? 'selected' : ''}>B (8)</option>
                        <option value="C" ${data?.grade === 'C' ? 'selected' : ''}>C (7)</option>
                        <option value="D" ${data?.grade === 'D' ? 'selected' : ''}>D (6)</option>
                        <option value="E" ${data?.grade === 'E' ? 'selected' : ''}>E (5)</option>
                        <option value="P" ${data?.grade === 'P' ? 'selected' : ''}>P (4)</option>
                        <option value="F" ${data?.grade === 'F' ? 'selected' : ''}>F (0)</option>
                        <option value="R" ${data?.grade === 'R' ? 'selected' : ''}>R (0)</option>
                    </select></div>
                <button type="submit" class="btn btn-primary btn-block">${editMode ? 'Update' : 'Add'} Grade</button>
            `;
            if (editMode && data) {
                form.querySelector(`select[name="roll_no"]`).value = data.roll_no;
                form.querySelector(`select[name="course_code"]`).value = data.course_code;
            }
            form.dataset.type = 'grade';
            break;

        case 'course':
            title.textContent = editMode ? 'Edit Course' : 'Add Course';
            form.innerHTML = `
                <div class="form-group"><label>Course Code</label>
                    <input type="text" name="course_code" value="${data?.course_code || ''}" ${editMode ? 'readonly' : 'required'}></div>
                <div class="form-group"><label>Course Name</label>
                    <input type="text" name="course_name" value="${data?.course_name || ''}" required></div>
                <div class="form-group"><label>Credits</label>
                    <input type="number" name="credits" min="1" max="10" value="${data?.credits || ''}" required></div>
                <button type="submit" class="btn btn-primary btn-block">${editMode ? 'Update' : 'Add'} Course</button>
            `;
            form.dataset.type = 'course';
            break;
    }

    overlay.classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editMode = false;
    editId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const type = e.target.dataset.type;
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());

    try {
        if (type === 'student') {
            if (editMode) {
                await API.put(`/students/${editId}`, data);
            } else {
                await API.post('/students', data);
            }
            showToast(`Student ${editMode ? 'updated' : 'added'} successfully`);
        } else if (type === 'mark') {
            await API.post('/marks', data);
            showToast(`Marks ${editMode ? 'updated' : 'added'} successfully`);
        } else if (type === 'grade') {
            await API.post('/student_details', data);
            showToast(`Grade ${editMode ? 'updated' : 'added'} successfully`);
        } else if (type === 'course') {
            await API.post('/courses', data);
            showToast(`Course ${editMode ? 'updated' : 'added'} successfully`);
        }
        closeModal();
        await loadAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editStudent(rollNo) {
    const s = students.find(x => x.rollNo === rollNo);
    if (s) openModal('student', s);
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

function editMark(index) {
    openModal('mark', marks[index]);
}

async function deleteMark(index) {
    if (!confirm('Delete this mark entry?')) return;
    try {
        const m = marks[index];
        const all = await API.get(`/marks?roll_no=${m.roll_no}&course_code=${m.course_code}`);
        if (all.length) {
            await API.delete(`/marks/${all[0].id || index}`);
        }
        showToast('Mark deleted');
        await loadAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editGrade(index) {
    openModal('grade', grades[index]);
}

async function deleteGrade(index) {
    if (!confirm('Delete this grade entry?')) return;
    try {
        const g = grades[index];
        const detail = grades[index];
        if (detail && detail.roll_no) {
            const all = await API.get(`/student_details?roll_no=${detail.roll_no}`);
            const match = all.find(x => x.course_code === detail.course_code && x.semester === detail.semester);
            if (match) {
                await API.delete(`/student_details/${match.id || index}`);
            }
        }
        showToast('Grade deleted');
        await loadAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editCourse(index) {
    openModal('course', courses[index]);
}

async function deleteCourse(index) {
    if (!confirm('Delete this course?')) return;
    try {
        await API.delete(`/courses/${courses[index].course_code}`);
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
