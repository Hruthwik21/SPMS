let marksData = [];
let sgpaCgpaData = [];
let studentDetailsData = [];
let gradePointsData = [];
let coursesData = [];
let passStats = [];
let cgpaStats = [];
let pieChart = null;
let barChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    await fetchAllData();
    renderMarksTable();
    renderGpaTable();
    renderCourseTable();
    renderCoursesTable();
    renderGradePointsTable();
    await fetchPassStats();
    await fetchCgpaStats();
    populateDepartmentSelect();
    setupChartListeners();

    document.getElementById("addStudent").addEventListener("click", addStudent);
    document.getElementById("deleteStudent").addEventListener("click", deleteStudent);
    document.getElementById("addMarksRow").addEventListener("click", addMarksRow);
    document.getElementById("addGpaRow").addEventListener("click", addGpaRow);
    document.getElementById("addCourseRow").addEventListener("click", addStudentDetailsRow);
    document.getElementById("addCoursesRow").addEventListener("click", addCoursesRow);
    document.getElementById("addGradePointsRow").addEventListener("click", addGradePointsRow);
    document.getElementById("searchMarks").addEventListener("click", searchMarks);
    document.getElementById("searchGpa").addEventListener("click", searchGpa);
    document.getElementById("searchCourse").addEventListener("click", searchCourse);
    document.getElementById("searchCourses").addEventListener("click", searchCourses);
});

async function fetchAllData() {
    try {
        marksData = await (await fetch("http://localhost:3000/marks")).json();
        sgpaCgpaData = await (await fetch("http://localhost:3000/sgpa_cgpa")).json();
        studentDetailsData = await (await fetch("http://localhost:3000/student_details")).json();
        gradePointsData = await (await fetch("http://localhost:3000/grade_points")).json();
        coursesData = await (await fetch("http://localhost:3000/courses")).json();

        marksData.sort((a, b) => a.roll_no.localeCompare(b.roll_no) || a.course_code.localeCompare(b.course_code));
        sgpaCgpaData.sort((a, b) => a.roll_no.localeCompare(b.roll_no) || a.semester - b.semester);
        studentDetailsData.sort((a, b) => a.roll_no.localeCompare(b.roll_no) || a.course_code.localeCompare(b.course_code));
        gradePointsData.sort((a, b) => a.grade.localeCompare(b.grade));
        coursesData.sort((a, b) => a.course_code.localeCompare(b.course_code));
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Failed to fetch data. Check the server.");
    }
}

async function fetchPassStats() {
    try {
        passStats = await (await fetch("http://localhost:3000/pass_stats")).json();
    } catch (error) {
        console.error("Error fetching pass stats:", error);
        alert("Failed to fetch pass stats.");
    }
}

async function fetchCgpaStats() {
    try {
        cgpaStats = await (await fetch("http://localhost:3000/cgpa_stats")).json();
        renderBarChart('avg');
    } catch (error) {
        console.error("Error fetching CGPA stats:", error);
        alert("Failed to fetch CGPA stats.");
    }
}

function populateDepartmentSelect() {
    const select = document.getElementById("departmentSelect");
    select.innerHTML = '<option value="">-- Select a Department --</option>';
    passStats.forEach(stat => {
        const option = document.createElement("option");
        option.value = stat.department;
        option.textContent = stat.department;
        select.appendChild(option);
    });
}

function setupChartListeners() {
    const deptSelect = document.getElementById("departmentSelect");
    deptSelect.addEventListener("change", (e) => {
        const dept = e.target.value;
        renderPieChart(dept);
    });

    const cgpaSelect = document.getElementById("cgpaOptionSelect");
    cgpaSelect.addEventListener("change", (e) => {
        const option = e.target.value;
        renderBarChart(option);
    });
}

function renderPieChart(department) {
    const ctx = document.getElementById("passPieChart").getContext("2d");
    if (pieChart) pieChart.destroy();

    if (!department) {
        pieChart = new Chart(ctx, {
            type: 'pie', data: { labels: ['Select a Department'], datasets: [{ data: [100], backgroundColor: ['#ccc'] }] },
            options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Pass/Fail Distribution' } } }
        });
        return;
    }

    const stat = passStats.find(s => s.department === department);
    if (!stat || stat.total === 0) {
        pieChart = new Chart(ctx, {
            type: 'pie', data: { labels: ['No Data'], datasets: [{ data: [100], backgroundColor: ['#ccc'] }] },
            options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: `${department} - No Data Available` } } }
        });
        return;
    }

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: ['Pass', 'Fail'], datasets: [{ data: [stat.pass, stat.fail], backgroundColor: ['#2ecc71', '#e74c3c'], borderColor: ['#27ae60', '#c0392b'], borderWidth: 1 }] },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${department} Pass/Fail Distribution` },
                tooltip: { callbacks: { label: context => `${context.label}: ${context.raw} (${((context.raw / stat.total) * 100).toFixed(2)}%)` } }
            }
        }
    });
}

function renderBarChart(option) {
    const ctx = document.getElementById("cgpaBarChart").getContext("2d");
    if (barChart) barChart.destroy();

    if (!cgpaStats.length) {
        barChart = new Chart(ctx, {
            type: 'bar', data: { labels: ['No Data'], datasets: [{ label: 'CGPA', data: [0], backgroundColor: '#ccc', borderColor: '#999', borderWidth: 1 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 10, title: { display: true, text: 'CGPA' } }, x: { title: { display: true, text: 'Department' } } }, plugins: { legend: { display: false }, title: { display: true, text: 'No CGPA Data Available' } } }
        });
        return;
    }

    const labels = cgpaStats.map(stat => stat.department);
    const data = cgpaStats.map(stat => stat[option]);

    barChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: `${option.toUpperCase()} CGPA`, data, backgroundColor: '#3b82f6', borderColor: '#2563eb', borderWidth: 1 }] },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 10, title: { display: true, text: 'CGPA' }, ticks: { stepSize: 1 } }, x: { title: { display: true, text: 'Department' } } },
            plugins: { legend: { position: 'top' }, title: { display: true, text: `${option.toUpperCase()} CGPA by Department` }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.raw.toFixed(2)}` } } }
        }
    });
}

function showForm(title, fields, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <form id="modalForm">
                ${fields.map(f => `
                    <div class="form-group">
                        <label>${f.label}</label>
                        ${f.options ? `
                            <select name="${f.name}" ${f.required ? 'required' : ''}>
                                <option value="">-- Select ${f.label} --</option>
                                ${f.options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('')}
                            </select>
                        ` : `
                            <input type="${f.type || 'text'}" name="${f.name}" value="${f.value || ''}" ${f.required ? 'required' : ''} ${f.max ? `max="${f.max}"` : ''} ${f.min ? `min="${f.min}"` : ''}>
                        `}
                    </div>
                `).join('')}
                <button type="submit">Save</button>
                <button type="button" class="cancel">Cancel</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        callback(Object.fromEntries(new FormData(e.target)));
        modal.remove();
    };
    modal.querySelector('.cancel').onclick = () => modal.remove();
}

// Search Marks
function searchMarks() {
    showForm('Search Marks', [
        {
            label: 'Category',
            name: 'category',
            required: true,
            options: [
                { value: 'roll_no', text: 'Roll No' },
                { value: 'course_code', text: 'Course Code' }
            ]
        }
    ], (data) => {
        const category = data.category;
        showForm(`Search by ${category === 'roll_no' ? 'Roll No' : 'Course Code'}`, [
            { label: category === 'roll_no' ? 'Roll No' : 'Course Code', name: 'value', required: true }
        ], (inputData) => {
            const value = inputData.value;
            const filteredData = marksData.filter(row => row[category] === value);
            renderMarksTable(filteredData);
        });
    });
}

// Search SGPA/CGPA
function searchGpa() {
    showForm('Search SGPA/CGPA', [
        {
            label: 'Category',
            name: 'category',
            required: true,
            options: [
                { value: 'roll_no', text: 'Roll No' },
                { value: 'department', text: 'Department' },
                { value: 'academic_year', text: 'Academic Year' },
                { value: 'semester', text: 'Semester' }
            ]
        }
    ], (data) => {
        const category = data.category;
        const field = {
            roll_no: { label: 'Roll No', type: 'text' },
            department: { label: 'Department', type: 'text' },
            academic_year: { label: 'Academic Year', type: 'text' },
            semester: { label: 'Semester', type: 'number', min: 1, max: 8 }
        }[category];
        showForm(`Search by ${field.label}`, [
            { label: field.label, name: 'value', type: field.type, required: true, min: field.min, max: field.max }
        ], (inputData) => {
            const value = category === 'semester' ? parseInt(inputData.value) : inputData.value;
            const filteredData = sgpaCgpaData.filter(row => row[category] == value);
            renderGpaTable(filteredData);
        });
    });
}

// Search Student Details
function searchCourse() {
    showForm('Search Student Details', [
        {
            label: 'Category',
            name: 'category',
            required: true,
            options: [
                { value: 'roll_no', text: 'Roll No' },
                { value: 'department', text: 'Department' },
                { value: 'academic_year', text: 'Academic Year' },
                { value: 'semester', text: 'Semester' },
                { value: 'course_code', text: 'Course Code' }
            ]
        }
    ], (data) => {
        const category = data.category;
        const field = {
            roll_no: { label: 'Roll No', type: 'text' },
            department: { label: 'Department', type: 'text' },
            academic_year: { label: 'Academic Year', type: 'text' },
            semester: { label: 'Semester', type: 'number', min: 1, max: 8 },
            course_code: { label: 'Course Code', type: 'text' }
        }[category];
        showForm(`Search by ${field.label}`, [
            { label: field.label, name: 'value', type: field.type, required: true, min: field.min, max: field.max }
        ], (inputData) => {
            const value = category === 'semester' ? parseInt(inputData.value) : inputData.value;
            const filteredData = studentDetailsData.filter(row => row[category] == value);
            renderCourseTable(filteredData);
        });
    });
}

// Search Courses
function searchCourses() {
    const courseCode = document.getElementById("courseCodeSearch").value.trim();
    if (!courseCode) {
        alert("Please enter a Course Code.");
        return;
    }
    const filteredData = coursesData.filter(row => row.course_code.toLowerCase().includes(courseCode.toLowerCase()));
    renderCoursesTable(filteredData);
}

// Delete Student
async function deleteStudent() {
    showForm('Delete Student', [
        { label: 'Roll No', name: 'roll_no', required: true }
    ], async (data) => {
        if (!confirm(`Are you sure you want to delete all data for Roll No ${data.roll_no}? This action cannot be undone.`)) return;
        try {
            const response = await fetch(`http://localhost:3000/students/${data.roll_no}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderMarksTable();
            renderGpaTable();
            renderCourseTable();
            renderCoursesTable();
            renderGradePointsTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
            alert(`All data for Roll No ${data.roll_no} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting student:", error);
            alert("Failed to delete student: " + error.message);
        }
    });
}

// Marks Table
function renderMarksTable(data = marksData) {
    const tbody = document.getElementById("marksTbody");
    tbody.innerHTML = data.length ? data.map(row => `
        <tr>
            <td>${row.roll_no}</td>
            <td>${row.course_code}</td>
            <td>${row.minor_1 || ""}</td>
            <td>${row.mid || ""}</td>
            <td>${row.minor_2 || ""}</td>
            <td>${row.endsem || ""}</td>
            <td>
                <button class="edit" data-id="${row.roll_no}-${row.course_code}">Edit</button>
            </td>
        </tr>
    `).join("") : '<tr><td colspan="7" class="empty-message">No records found.</td></tr>';
    addEventListeners("marksTbody", editMarksRow, null);
}

async function addMarksRow() {
    const courseOptions = coursesData.map(course => ({
        value: course.course_code,
        text: `${course.course_code} - ${course.course_name} (${course.credits} credits)`
    }));

    showForm('Add Marks', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Course Code', name: 'course_code', required: true, options: courseOptions },
        { label: 'Minor-1', name: 'minor_1', type: 'number', min: 0, max: 10 },
        { label: 'Mid', name: 'mid', type: 'number', min: 0, max: 30 },
        { label: 'Minor-2', name: 'minor_2', type: 'number', min: 0, max: 10 },
        { label: 'End Sem', name: 'endsem', type: 'number', min: 0, max: 50 }
    ], async (data) => {
        try {
            const response = await fetch("http://localhost:3000/marks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderMarksTable();
            renderGpaTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error adding marks:", error);
            alert("Failed to add marks: " + error.message);
        }
    });
}

async function editMarksRow(id) {
    const [roll_no, course_code] = id.split('-');
    const row = marksData.find(r => r.roll_no === roll_no && r.course_code === course_code);
    if (!row) return;

    showForm('Edit Marks', [
        { label: 'Minor-1', name: 'minor_1', type: 'number', value: row.minor_1 || '', min: 0, max: 10 },
        { label: 'Mid', name: 'mid', type: 'number', value: row.mid || '', min: 0, max: 30 },
        { label: 'Minor-2', name: 'minor_2', type: 'number', value: row.minor_2 || '', min: 0, max: 10 },
        { label: 'End Sem', name: 'endsem', type: 'number', value: row.endsem || '', min: 0, max: 50 }
    ], async (data) => {
        try {
            const response = await fetch(`http://localhost:3000/marks/${roll_no}/${course_code}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderMarksTable();
            renderGpaTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error editing marks:", error);
            alert("Failed to edit marks: " + error.message);
        }
    });
}

// SGPA & CGPA Tracker
function renderGpaTable(data = sgpaCgpaData) {
    const tbody = document.getElementById("gpaTbody");
    tbody.innerHTML = data.length ? data.map(row => `
        <tr>
            <td>${row.roll_no}</td>
            <td>${row.name}</td>
            <td>${row.department}</td>
            <td>${row.academic_year}</td>
            <td>${row.semester}</td>
            <td>${row.sgpa !== null ? row.sgpa.toFixed(2) : "N/A"}</td>
            <td>${row.cgpa !== null ? row.cgpa.toFixed(2) : "N/A"}</td>
            <td>
                <button class="edit" data-id="${row.roll_no}-${row.semester}">Edit</button>
                <button class="delete" data-id="${row.roll_no}-${row.semester}">Delete</button>
            </td>
        </tr>
    `).join("") : '<tr><td colspan="8" class="empty-message">No records found.</td></tr>';
    addEventListeners("gpaTbody", editGpaRow, deleteGpaRow);
}

async function addGpaRow() {
    showForm('Add Semester Record', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Semester', name: 'semester', type: 'number', min: 1, max: 8, required: true },
        { label: 'Academic Year', name: 'academic_year', required: true }
    ], async (data) => {
        try {
            const response = await fetch("http://localhost:3000/sgpa_cgpa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderGpaTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error adding semester record:", error);
            alert("Failed to add semester record: " + error.message);
        }
    });
}

async function editGpaRow(id) {
    const [roll_no, semester] = id.split('-');
    const row = sgpaCgpaData.find(r => r.roll_no === roll_no && r.semester === parseInt(semester));
    if (!row) return;

    showForm('Edit Semester Record', [
        { label: 'Academic Year', name: 'academic_year', value: row.academic_year, required: true }
    ], async (data) => {
        try {
            const response = await fetch(`http://localhost:3000/sgpa_cgpa/${roll_no}/${semester}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderGpaTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error editing semester record:", error);
            alert("Failed to edit semester record: " + error.message);
        }
    });
}

async function deleteGpaRow(id) {
    if (!confirm("Are you sure? This will delete all related records for this semester.")) return;
    const [roll_no, semester] = id.split('-');
    try {
        const response = await fetch(`http://localhost:3000/sgpa_cgpa/${roll_no}/${semester}`, {
            method: "DELETE"
        });
        if (!response.ok) throw new Error(await response.text());
        await fetchAllData();
        await fetchPassStats();
        await fetchCgpaStats();
        renderGpaTable();
        renderMarksTable();
        renderCourseTable();
        populateDepartmentSelect();
        renderPieChart(document.getElementById("departmentSelect").value);
        renderBarChart(document.getElementById("cgpaOptionSelect").value);
    } catch (error) {
        console.error("Error deleting semester record:", error);
        alert("Failed to delete semester record: " + error.message);
    }
}

// Student Details
function renderCourseTable(data = studentDetailsData) {
    const tbody = document.getElementById("courseTbody");
    tbody.innerHTML = data.length ? data.map(row => `
        <tr>
            <td>${row.roll_no}</td>
            <td>${row.name}</td>
            <td>${row.department}</td>
            <td>${row.academic_year}</td>
            <td>${row.semester}</td>
            <td>${row.course_name}</td>
            <td>${row.course_code}</td>
            <td>${row.credits || ""}</td>
            <td>${row.grade || ""}</td>
            <td>
                <button class="edit" data-id="${row.roll_no}-${row.course_code}">Edit</button>
                <button class="delete" data-id="${row.roll_no}-${row.course_code}">Delete</button>
            </td>
        </tr>
    `).join("") : '<tr><td colspan="10" class="empty-message">No records found.</td></tr>';
    addEventListeners("courseTbody", editStudentDetailsRow, deleteStudentDetailsRow);
}

async function addStudentDetailsRow() {
    const courseOptions = coursesData.map(course => ({
        value: course.course_code,
        text: `${course.course_code} - ${course.course_name} (${course.credits} credits)`
    }));
    const gradeOptions = gradePointsData.map(grade => ({
        value: grade.grade,
        text: `${grade.grade} (${grade.points} points)`
    }));

    showForm('Add Student Details', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Course Code', name: 'course_code', required: true, options: courseOptions },
        { label: 'Academic Year', name: 'academic_year', required: true },
        { label: 'Semester', name: 'semester', type: 'number', min: 1, max: 8, required: true },
        { label: 'Grade', name: 'grade', options: gradeOptions }
    ], async (data) => {
        try {
            const response = await fetch("http://localhost:3000/student_details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderCourseTable();
            renderGpaTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error adding student details:", error);
            alert(`Failed to add student details: ${error.message}`);
        }
    });
}

async function editStudentDetailsRow(id) {
    const [roll_no, course_code] = id.split('-');
    const row = studentDetailsData.find(r => r.roll_no === roll_no && r.course_code === course_code);
    if (!row) return;

    const gradeOptions = gradePointsData.map(grade => ({
        value: grade.grade,
        text: `${grade.grade} (${grade.points} points)`
    }));

    showForm('Edit Student Details', [
        { label: 'Academic Year', name: 'academic_year', value: row.academic_year, required: true },
        { label: 'Semester', name: 'semester', type: 'number', value: row.semester, min: 1, max: 8, required: true },
        { label: 'Grade', name: 'grade', value: row.grade || '', options: gradeOptions }
    ], async (data) => {
        try {
            const response = await fetch(`http://localhost:3000/student_details/${roll_no}/${course_code}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderCourseTable();
            renderGpaTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error editing student details:", error);
            alert("Failed to edit student details: " + error.message);
        }
    });
}

async function deleteStudentDetailsRow(id) {
    if (!confirm("Are you sure? This will also delete related marks.")) return;
    const [roll_no, course_code] = id.split('-');
    try {
        const response = await fetch(`http://localhost:3000/student_details/${roll_no}/${course_code}`, {
            method: "DELETE"
        });
        if (!response.ok) throw new Error(await response.text());
        await fetchAllData();
        await fetchPassStats();
        await fetchCgpaStats();
        renderCourseTable();
        renderMarksTable();
        renderGpaTable();
        populateDepartmentSelect();
        renderPieChart(document.getElementById("departmentSelect").value);
        renderBarChart(document.getElementById("cgpaOptionSelect").value);
    } catch (error) {
        console.error("Error deleting student details:", error);
        alert("Failed to delete student details: " + error.message);
    }
}

// Courses Table
function renderCoursesTable(data = coursesData) {
    const tbody = document.getElementById("coursesTbody");
    tbody.innerHTML = data.length ? data.map(row => `
        <tr>
            <td>${row.course_code}</td>
            <td>${row.course_name}</td>
            <td>${row.credits}</td>
            <td>
                <button class="edit" data-id="${row.course_code}">Edit</button>
                <button class="delete" data-id="${row.course_code}">Delete</button>
            </td>
        </tr>
    `).join("") : '<tr><td colspan="4" class="empty-message">No records found.</td></tr>';
    addEventListeners("coursesTbody", editCoursesRow, deleteCoursesRow);
}

async function addCoursesRow() {
    showForm('Add Course', [
        { label: 'Course Code', name: 'course_code', required: true },
        { label: 'Course Name', name: 'course_name', required: true },
        { label: 'Credits', name: 'credits', type: 'number', min: 1, required: true }
    ], async (data) => {
        try {
            const response = await fetch("http://localhost:3000/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            renderCoursesTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error adding course:", error);
            alert("Failed to add course: " + error.message);
        }
    });
}

async function editCoursesRow(id) {
    const row = coursesData.find(r => r.course_code === id);
    if (!row) return;

    showForm('Edit Course', [
        { label: 'Course Name', name: 'course_name', value: row.course_name, required: true },
        { label: 'Credits', name: 'credits', type: 'number', value: row.credits, min: 1, required: true }
    ], async (data) => {
        try {
            const response = await fetch(`http://localhost:3000/courses/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            renderCoursesTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error editing course:", error);
            alert("Failed to edit course: " + error.message);
        }
    });
}

async function deleteCoursesRow(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch(`http://localhost:3000/courses/${id}`, {
            method: "DELETE"
        });
        if (!response.ok) throw new Error(await response.text());
        await fetchAllData();
        renderCoursesTable();
        renderCourseTable();
        populateDepartmentSelect();
        renderPieChart(document.getElementById("departmentSelect").value);
        renderBarChart(document.getElementById("cgpaOptionSelect").value);
    } catch (error) {
        console.error("Error deleting course:", error);
        alert("Failed to delete course: " + error.message);
    }
}

// Grade Points
function renderGradePointsTable() {
    const tbody = document.getElementById("gradePointsTbody");
    tbody.innerHTML = gradePointsData.map(row => `
        <tr>
            <td>${row.grade}</td>
            <td>${row.points}</td>
            <td>
                <button class="edit" data-id="${row.grade}">Edit</button>
                <button class="delete" data-id="${row.grade}">Delete</button>
            </td>
        </tr>
    `).join("");
    addEventListeners("gradePointsTbody", editGradePointsRow, deleteGradePointsRow);
}

async function addGradePointsRow() {
    showForm('Add Grade', [
        { label: 'Grade', name: 'grade', required: true },
        { label: 'Points', name: 'points', type: 'number', min: 0, max: 10, required: true }
    ], async (data) => {
        try {
            const response = await fetch("http://localhost:3000/grade_points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderGradePointsTable();
            renderGpaTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error adding grade points:", error);
            alert("Failed to add grade points: " + error.message);
        }
    });
}

async function editGradePointsRow(id) {
    const row = gradePointsData.find(r => r.grade === id);
    if (!row) return;

    showForm('Edit Grade', [
        { label: 'Grade', name: 'grade', value: row.grade, required: true },
        { label: 'Points', name: 'points', type: 'number', value: row.points, min: 0, max: 10, required: true }
    ], async (data) => {
        try {
            const response = await fetch(`http://localhost:3000/grade_points/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(await response.text());
            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderGradePointsTable();
            renderGpaTable();
            renderCourseTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error editing grade points:", error);
            alert("Failed to edit grade points: " + error.message);
        }
    });
}

async function deleteGradePointsRow(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const response = await fetch(`http://localhost:3000/grade_points/${id}`, {
            method: "DELETE"
        });
        if (!response.ok) throw new Error(await response.text());
        await fetchAllData();
        await fetchPassStats();
        await fetchCgpaStats();
        renderGradePointsTable();
        renderGpaTable();
        renderCourseTable();
        populateDepartmentSelect();
        renderPieChart(document.getElementById("departmentSelect").value);
        renderBarChart(document.getElementById("cgpaOptionSelect").value);
    } catch (error) {
        console.error("Error deleting grade points:", error);
        alert("Failed to delete grade points: " + error.message);
    }
}

// Add Student
async function addStudent() {
    const courseOptions = coursesData.map(course => ({
        value: course.course_code,
        text: `${course.course_code} - ${course.course_name} (${course.credits} credits)`
    }));
    const gradeOptions = gradePointsData.map(grade => ({
        value: grade.grade,
        text: `${grade.grade} (${grade.points} points)`
    }));

    showForm('Add Student', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Name', name: 'name', required: true },
        { label: 'Department', name: 'department', required: true },
        { label: 'Academic Year', name: 'academic_year', required: true },
        { label: 'Semester', name: 'semester', type: 'number', min: 1, max: 8, required: true },
        { label: 'Course Code', name: 'course_code', required: true, options: courseOptions },
        { label: 'Minor-1', name: 'minor_1', type: 'number', min: 0, max: 10 },
        { label: 'Mid', name: 'mid', type: 'number', min: 0, max: 30 },
        { label: 'Minor-2', name: 'minor_2', type: 'number', min: 0, max: 10 },
        { label: 'End Sem', name: 'endsem', type: 'number', min: 0, max: 50 },
        { label: 'Grade', name: 'grade', options: gradeOptions }
    ], async (data) => {
        try {
            await fetch("http://localhost:3000/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roll_no: data.roll_no,
                    name: data.name,
                    department: data.department
                })
            });

            await fetch("http://localhost:3000/student_details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roll_no: data.roll_no,
                    course_code: data.course_code,
                    academic_year: data.academic_year,
                    semester: data.semester,
                    grade: data.grade
                })
            });

            await fetch("http://localhost:3000/marks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roll_no: data.roll_no,
                    course_code: data.course_code,
                    minor_1: data.minor_1,
                    mid: data.mid,
                    minor_2: data.minor_2,
                    endsem: data.endsem
                })
            });

            await fetch("http://localhost:3000/sgpa_cgpa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    roll_no: data.roll_no,
                    semester: data.semester,
                    academic_year: data.academic_year
                })
            });

            await fetchAllData();
            await fetchPassStats();
            await fetchCgpaStats();
            renderMarksTable();
            renderGpaTable();
            renderCourseTable();
            renderCoursesTable();
            populateDepartmentSelect();
            renderPieChart(document.getElementById("departmentSelect").value);
            renderBarChart(document.getElementById("cgpaOptionSelect").value);
        } catch (error) {
            console.error("Error adding student:", error);
            alert("Failed to add student: " + error.message);
        }
    });
}

function addEventListeners(tbodyId, editFn, deleteFn) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.querySelectorAll(".edit").forEach(button => {
        button.addEventListener("click", () => editFn(button.dataset.id));
    });
    if (deleteFn) {
        tbody.querySelectorAll(".delete").forEach(button => {
            button.addEventListener("click", () => deleteFn(button.dataset.id));
        });
    }
}
