let marksData = [];
let sgpaCgpaData = [];
let studentDetailsData = [];
let gradePointsData = [];
let coursesData = [];
let passStats = [];
let cgpaStats = [];
let pieChart = null;
let barChart = null;
let userInfo = null;

document.addEventListener("DOMContentLoaded", async () => {
    // Check if user is logged in
    checkAuthStatus();
    
    // Display user department info
    displayUserInfo();
    
    await fetchAllData();
    renderMarksTable();
    renderGpaTable();
    renderCourseTable();
    renderCoursesTable();
    renderGradePointsTable();
    await fetchPassStats();
    await fetchCgpaStats();
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
    
    // Add logout listener
    document.querySelector('a[href="#logout"]').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
});

function checkAuthStatus() {
    const token = localStorage.getItem('auth_token');
    const userInfoStr = localStorage.getItem('user_info');
    
    if (!token || !userInfoStr) {
        // Redirect to login if not logged in
        window.location.href = 'login.html';
        return;
    }
    
    try {
        userInfo = JSON.parse(userInfoStr);
    } catch (error) {
        console.error('Error parsing user info:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'login.html';
    }
}

function displayUserInfo() {
    if (userInfo) {
        const deptBadge = document.createElement('div');
        deptBadge.className = 'department-badge';
        deptBadge.innerHTML = `
            <span>Department: ${userInfo.department === 'ALL' ? 'Administrator (All Departments)' : userInfo.department}</span>
            <span>User: ${userInfo.username}</span>
        `;
        
        // Insert after the button group
        const buttonGroup = document.querySelector('.button-group');
        buttonGroup.parentNode.insertBefore(deptBadge, buttonGroup.nextSibling);
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = 'login.html';
}

async function fetchAllData() {
    try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        marksData = await (await fetch("http://localhost:3000/marks", { headers })).json();
        sgpaCgpaData = await (await fetch("http://localhost:3000/sgpa_cgpa", { headers })).json();
        studentDetailsData = await (await fetch("http://localhost:3000/student_details", { headers })).json();
        gradePointsData = await (await fetch("http://localhost:3000/grade_points", { headers })).json();
        coursesData = await (await fetch("http://localhost:3000/courses", { headers })).json();

        marksData.sort((a, b) => a.roll_no.localeCompare(b.roll_no) || a.course_code.localeCompare(b.course_code));
        sgpaCgpaData.sort((a, b) => a.roll_no.localeCompare(b.roll_no) || a.semester - b.semester);
        studentDetailsData.sort((a, b) => a.roll_no.localeCompare(b.roll_no) || a.course_code.localeCompare(b.course_code));
        gradePointsData.sort((a, b) => a.grade.localeCompare(b.grade));
        coursesData.sort((a, b) => a.course_code.localeCompare(b.course_code));
    } catch (error) {
        console.error("Error fetching data:", error);
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
            alert("Your session has expired. Please login again.");
            logout();
        } else {
            alert("Failed to fetch data. Check the server.");
        }
    }
}

async function fetchPassStats() {
    try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        passStats = await (await fetch("http://localhost:3000/pass_stats", { headers })).json();
        
        // If user is not admin, directly render the pie chart for their department
        if (userInfo && userInfo.department !== 'ALL' && passStats.length > 0) {
            renderPieChart(userInfo.department);
        }
    } catch (error) {
        console.error("Error fetching pass stats:", error);
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
            alert("Your session has expired. Please login again.");
            logout();
        } else {
            alert("Failed to fetch pass stats.");
        }
    }
}

async function fetchCgpaStats() {
    try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        cgpaStats = await (await fetch("http://localhost:3000/cgpa_stats", { headers })).json();
        renderBarChart('avg');
    } catch (error) {
        console.error("Error fetching CGPA stats:", error);
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
            alert("Your session has expired. Please login again.");
            logout();
        } else {
            alert("Failed to fetch CGPA stats.");
        }
    }
}

function setupChartListeners() {
    const deptSelect = document.getElementById("departmentSelect");
    
    // Only show department select for admin users
    if (userInfo && userInfo.department !== 'ALL') {
        deptSelect.parentElement.style.display = 'none';
    } else {
        deptSelect.innerHTML = '<option value="">-- Select a Department --</option>';
        passStats.forEach(stat => {
            const option = document.createElement("option");
            option.value = stat.department;
            option.textContent = stat.department;
            deptSelect.appendChild(option);
        });
        
        deptSelect.addEventListener("change", (e) => {
            const dept = e.target.value;
            renderPieChart(dept);
        });
    }

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
    
    // If user is not admin and a department field is present, remove it
    if (userInfo && userInfo.department !== 'ALL') {
        fields = fields.filter(f => f.name !== 'department');
    }
    
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
    
    const form = modal.querySelector('form');
    
    // If user is not admin but we need a department field (e.g., for adding a student),
    // add a hidden field with the user's department
    if (userInfo && userInfo.department !== 'ALL' && fields.some(f => f.name === 'roll_no') && !fields.some(f => f.name === 'department')) {
        const hiddenDepartment = document.createElement('input');
        hiddenDepartment.type = 'hidden';
        hiddenDepartment.name = 'department';
        hiddenDepartment.value = userInfo.department;
        form.appendChild(hiddenDepartment);
    }
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // If user is not admin and we're adding/updating data that needs a department,
        // ensure the department is set to the user's department
        if (userInfo && userInfo.department !== 'ALL' && !data.department && (title.includes('Add Student') || title.includes('Add SGPA/CGPA'))) {
            data.department = userInfo.department;
        }
        
        callback(data);
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
    const options = [
        { value: 'roll_no', text: 'Roll No' },
        { value: 'academic_year', text: 'Academic Year' },
        { value: 'semester', text: 'Semester' }
    ];
    
    // Only include department if user is admin
    if (userInfo && userInfo.department === 'ALL') {
        options.splice(1, 0, { value: 'department', text: 'Department' });
    }
    
    showForm('Search SGPA/CGPA', [
        {
            label: 'Category',
            name: 'category',
            required: true,
            options: options
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
    const options = [
        { value: 'roll_no', text: 'Roll No' },
        { value: 'academic_year', text: 'Academic Year' },
        { value: 'semester', text: 'Semester' },
        { value: 'course_code', text: 'Course Code' }
    ];
    
    // Only include department if user is admin
    if (userInfo && userInfo.department === 'ALL') {
        options.splice(1, 0, { value: 'department', text: 'Department' });
    }
    
    showForm('Search Student Details', [
        {
            label: 'Category',
            name: 'category',
            required: true,
            options: options
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
        const roll_no = data.roll_no;
        if (!confirm(`Are you sure you want to delete student with Roll No: ${roll_no}? This will delete all related data.`)) {
            return;
        }
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`http://localhost:3000/students/${roll_no}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to delete student: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            renderMarksTable();
            renderGpaTable();
            renderCourseTable();
            renderCoursesTable();
            await fetchPassStats();
            await fetchCgpaStats();
            alert(`Student ${roll_no} and all related data deleted successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}

// Add Student
async function addStudent() {
    const fields = [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Name', name: 'name', required: true }
    ];
    
    // Only allow department selection for admin users
    if (userInfo && userInfo.department === 'ALL') {
        fields.push({ label: 'Department', name: 'department', required: true });
    }
    
    showForm('Add Student', fields, async (data) => {
        try {
            // If user is not admin, set the department to the user's department
            if (userInfo && userInfo.department !== 'ALL') {
                data.department = userInfo.department;
            }
            
            const token = localStorage.getItem('auth_token');
            const response = await fetch('http://localhost:3000/students', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add student: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            alert(`Student ${data.roll_no} added successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}

// Add Marks Row
function addMarksRow() {
    showForm('Add Marks', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Course Code', name: 'course_code', required: true },
        { label: 'Minor-1', name: 'minor_1', type: 'number', min: 0, max: 100 },
        { label: 'Mid', name: 'mid', type: 'number', min: 0, max: 100 },
        { label: 'Minor-2', name: 'minor_2', type: 'number', min: 0, max: 100 },
        { label: 'End Sem', name: 'endsem', type: 'number', min: 0, max: 100 }
    ], async (data) => {
        try {
            const token = localStorage.getItem('auth_token');
            
            // Check if student exists
            const studentResponse = await fetch(`http://localhost:3000/students/${data.roll_no}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!studentResponse.ok) {
                if (studentResponse.status === 404) {
                    alert(`Student with Roll No ${data.roll_no} does not exist. Please add the student first.`);
                    return;
                } else if (studentResponse.status === 403) {
                    const errorData = await studentResponse.json();
                    throw new Error(errorData.message || `You don't have permission to access this student's data`);
                } else {
                    throw new Error(`Failed to check student: ${studentResponse.status} ${studentResponse.statusText}`);
                }
            }
            
            // Now add the marks
            const response = await fetch('http://localhost:3000/marks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add marks: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            renderMarksTable();
            alert(`Marks for ${data.roll_no} in ${data.course_code} added successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}

// Remaining code for rendering tables and other operations will be the same
// as in the original implementation, with the addition of authentication headers

// Render Marks Table
function renderMarksTable(data = marksData) {
    const tbody = document.getElementById("marksTbody");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.roll_no}</td>
            <td>${row.course_code}</td>
            <td>${row.minor_1 !== null ? row.minor_1 : ''}</td>
            <td>${row.mid !== null ? row.mid : ''}</td>
            <td>${row.minor_2 !== null ? row.minor_2 : ''}</td>
            <td>${row.endsem !== null ? row.endsem : ''}</td>
            <td>
                <button class="edit" onclick="editMarks('${row.roll_no}', '${row.course_code}')">Edit</button>
                <button class="delete" onclick="deleteMarks('${row.roll_no}', '${row.course_code}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render GPA Table
function renderGpaTable(data = sgpaCgpaData) {
    const tbody = document.getElementById("gpaTbody");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.roll_no}</td>
            <td>${row.name}</td>
            <td>${row.department}</td>
            <td>${row.academic_year}</td>
            <td>${row.semester}</td>
            <td>${row.sgpa !== null ? row.sgpa.toFixed(2) : ''}</td>
            <td>${row.cgpa !== null ? row.cgpa.toFixed(2) : ''}</td>
            <td>
                <button class="edit" onclick="editGpa('${row.roll_no}', ${row.semester})">Edit</button>
                <button class="delete" onclick="deleteGpa('${row.roll_no}', ${row.semester})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Course Table (Student Details)
function renderCourseTable(data = studentDetailsData) {
    const tbody = document.getElementById("courseTbody");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.roll_no}</td>
            <td>${row.name}</td>
            <td>${row.department}</td>
            <td>${row.academic_year}</td>
            <td>${row.semester}</td>
            <td>${row.course_name}</td>
            <td>${row.course_code}</td>
            <td>${row.credits}</td>
            <td>${row.grade}</td>
            <td>
                <button class="edit" onclick="editStudentDetail('${row.roll_no}', '${row.course_code}')">Edit</button>
                <button class="delete" onclick="deleteStudentDetail('${row.roll_no}', '${row.course_code}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Courses Table
function renderCoursesTable(data = coursesData) {
    const tbody = document.getElementById("coursesTbody");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.course_code}</td>
            <td>${row.course_name}</td>
            <td>${row.credits}</td>
            <td>
                <button class="edit" onclick="editCourse('${row.course_code}')">Edit</button>
                <button class="delete" onclick="deleteCourse('${row.course_code}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Grade Points Table
function renderGradePointsTable(data = gradePointsData) {
    const tbody = document.getElementById("gradePointsTbody");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.grade}</td>
            <td>${row.points}</td>
            <td>
                <button class="edit" onclick="editGradePoint('${row.grade}')">Edit</button>
                <button class="delete" onclick="deleteGradePoint('${row.grade}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// The rest of the implementation would be similar to the original code,
// adding authorization headers to all fetch requests and handling permissions appropriately.

// Add GPA Row
function addGpaRow() {
    showForm('Add SGPA/CGPA Record', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Semester', name: 'semester', type: 'number', required: true, min: 1, max: 8 },
        { label: 'Academic Year', name: 'academic_year', required: true }
    ], async (data) => {
        try {
            const token = localStorage.getItem('auth_token');
            
            // Check if student exists
            const studentResponse = await fetch(`http://localhost:3000/students/${data.roll_no}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!studentResponse.ok) {
                if (studentResponse.status === 404) {
                    alert(`Student with Roll No ${data.roll_no} does not exist. Please add the student first.`);
                    return;
                } else if (studentResponse.status === 403) {
                    const errorData = await studentResponse.json();
                    throw new Error(errorData.message || `You don't have permission to access this student's data`);
                } else {
                    throw new Error(`Failed to check student: ${studentResponse.status} ${studentResponse.statusText}`);
                }
            }
            
            // Now add the SGPA/CGPA record
            const response = await fetch('http://localhost:3000/sgpa_cgpa', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add SGPA/CGPA record: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            renderGpaTable();
            alert(`SGPA/CGPA record for ${data.roll_no} in semester ${data.semester} added successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}

// Add Student Details Row
function addStudentDetailsRow() {
    showForm('Add Student Details', [
        { label: 'Roll No', name: 'roll_no', required: true },
        { label: 'Course Code', name: 'course_code', required: true },
        { label: 'Grade', name: 'grade', required: true },
        { label: 'Academic Year', name: 'academic_year', required: true },
        { label: 'Semester', name: 'semester', type: 'number', required: true, min: 1, max: 8 }
    ], async (data) => {
        try {
            const token = localStorage.getItem('auth_token');
            
            // Check if student exists
            const studentResponse = await fetch(`http://localhost:3000/students/${data.roll_no}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!studentResponse.ok) {
                if (studentResponse.status === 404) {
                    alert(`Student with Roll No ${data.roll_no} does not exist. Please add the student first.`);
                    return;
                } else if (studentResponse.status === 403) {
                    const errorData = await studentResponse.json();
                    throw new Error(errorData.message || `You don't have permission to access this student's data`);
                } else {
                    throw new Error(`Failed to check student: ${studentResponse.status} ${studentResponse.statusText}`);
                }
            }
            
            // Now add the student details
            const response = await fetch('http://localhost:3000/student_details', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add student details: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            renderCourseTable();
            alert(`Student details for ${data.roll_no} in course ${data.course_code} added successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}

// Add Courses Row
function addCoursesRow() {
    showForm('Add Course', [
        { label: 'Course Code', name: 'course_code', required: true },
        { label: 'Course Name', name: 'course_name', required: true },
        { label: 'Credits', name: 'credits', type: 'number', required: true, min: 1, max: 10 }
    ], async (data) => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('http://localhost:3000/courses', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add course: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            renderCoursesTable();
            alert(`Course ${data.course_code} added successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}

// Add Grade Points Row
function addGradePointsRow() {
    showForm('Add Grade Point', [
        { label: 'Grade', name: 'grade', required: true },
        { label: 'Points', name: 'points', type: 'number', required: true, min: 0, max: 10, step: 0.1 }
    ], async (data) => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('http://localhost:3000/grade_points', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to add grade point: ${response.status} ${response.statusText}`);
            }
            
            await fetchAllData();
            renderGradePointsTable();
            alert(`Grade point ${data.grade} added successfully.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                logout();
            }
        }
    });
}
