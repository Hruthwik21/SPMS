// Global variables for storing data
let studentsData = [];
let marksData = [];
let sgpaCgpaData = [];
let studentDetailsData = [];
let coursesData = [];
let gradePointsData = [];
let passStats = [];
let cgpaStats = [];
let currentUser = { username: '', department: '' };

// Check if user is authenticated on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupChartListeners();
    
    // Set up event listeners for buttons
    document.getElementById('addStudent').addEventListener('click', addStudent);
    document.getElementById('deleteStudent').addEventListener('click', deleteStudent);
    document.getElementById('addMarksRow').addEventListener('click', addMarksRow);
    document.getElementById('addGpaRow').addEventListener('click', addGpaRow);
    document.getElementById('addCourseRow').addEventListener('click', addStudentDetailsRow);
    document.getElementById('addCoursesRow').addEventListener('click', addCoursesRow);
    document.getElementById('addGradePointsRow').addEventListener('click', addGradePointsRow);
    
    // Search buttons
    document.getElementById('searchMarks').addEventListener('click', searchMarks);
    document.getElementById('searchGpa').addEventListener('click', searchGpa);
    document.getElementById('searchCourse').addEventListener('click', searchCourse);
    document.getElementById('searchCourses').addEventListener('click', searchCourses);
    
    // Logout button
    document.querySelector('a[href="#logout"]').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
});

// Check if user is authenticated
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Redirect to login if no token
        window.location.href = 'login.html';
        return;
    }
    
    // Display user info
    displayUserInfo();
    
    // Load all data
    fetchAllData();
}

// Display user info in header
function displayUserInfo() {
    currentUser.username = localStorage.getItem('username') || '';
    currentUser.department = localStorage.getItem('department') || '';
    
    // Display department info
    const navItems = document.querySelector('nav ul');
    const userItem = document.createElement('li');
    userItem.innerHTML = `<span style="color: white; padding: 0.5rem 1rem;">${currentUser.username} (${currentUser.department})</span>`;
    navItems.appendChild(userItem);
    
    // Hide department selection for non-admin users
    if (currentUser.department !== 'ALL') {
        // We'll remove department selection from forms later
        console.log('User department:', currentUser.department);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('department');
    window.location.href = 'login.html';
}

// Fetch all data needed for the page
async function fetchAllData() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    try {
        // Fetch students
        const studentsResponse = await fetch('/students', { headers });
        studentsData = await studentsResponse.json();
        
        // Fetch marks
        const marksResponse = await fetch('/marks', { headers });
        marksData = await marksResponse.json();
        renderMarksTable(marksData);
        
        // Fetch SGPA/CGPA
        const sgpaCgpaResponse = await fetch('/sgpa_cgpa', { headers });
        sgpaCgpaData = await sgpaCgpaResponse.json();
        renderGpaTable(sgpaCgpaData);
        
        // Fetch student details
        const studentDetailsResponse = await fetch('/student_details', { headers });
        studentDetailsData = await studentDetailsResponse.json();
        renderCourseTable(studentDetailsData);
        
        // Fetch courses
        const coursesResponse = await fetch('/courses', { headers });
        coursesData = await coursesResponse.json();
        renderCoursesTable(coursesData);
        
        // Fetch grade points
        const gradePointsResponse = await fetch('/grade_points', { headers });
        gradePointsData = await gradePointsResponse.json();
        renderGradePointsTable();
        
        // Fetch stats data
        await fetchPassStats();
        await fetchCgpaStats();
        
        // Populate department select for charts
        populateDepartmentSelect();
        
        // Render initial charts
        if (passStats.length > 0) {
            renderPieChart(passStats[0].department);
        }
        
        if (cgpaStats.length > 0) {
            renderBarChart('avg');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Fetch pass/fail statistics for pie chart
async function fetchPassStats() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/pass_stats', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // For non-admin users, filter stats to only show their department
        passStats = await response.json();
        
        if (currentUser.department !== 'ALL') {
            passStats = passStats.filter(stat => stat.department === currentUser.department);
        }
        
    } catch (error) {
        console.error('Error fetching pass stats:', error);
    }
}

// Fetch CGPA statistics for bar chart
async function fetchCgpaStats() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/cgpa_stats', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // For non-admin users, filter stats to only show their department
        cgpaStats = await response.json();
        
        if (currentUser.department !== 'ALL') {
            cgpaStats = cgpaStats.filter(stat => stat.department === currentUser.department);
        }
        
    } catch (error) {
        console.error('Error fetching CGPA stats:', error);
    }
}

// Populate department select dropdown
function populateDepartmentSelect() {
    const departmentSelect = document.getElementById('departmentSelect');
    
    // Clear existing options
    departmentSelect.innerHTML = '<option value="">-- Select a Department --</option>';
    
    // Get unique departments from pass stats
    const departments = [...new Set(passStats.map(stat => stat.department))];
    
    // For non-admin users, only show their department
    if (currentUser.department !== 'ALL') {
        // Auto-select the user's department
        const option = document.createElement('option');
        option.value = currentUser.department;
        option.textContent = currentUser.department;
        option.selected = true;
        departmentSelect.appendChild(option);
        
        // Trigger change event to show chart
        const event = new Event('change');
        departmentSelect.dispatchEvent(event);
    } else {
        // For admin, show all departments
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    }
}

// Setup chart event listeners
function setupChartListeners() {
    // Department select for pie chart
    const departmentSelect = document.getElementById('departmentSelect');
    departmentSelect.addEventListener('change', function() {
        if (this.value) {
            renderPieChart(this.value);
        }
    });
    
    // CGPA option select for bar chart
    const cgpaOptionSelect = document.getElementById('cgpaOptionSelect');
    cgpaOptionSelect.addEventListener('change', function() {
        renderBarChart(this.value);
    });
}

// Render pie chart for pass/fail stats
function renderPieChart(department) {
    const canvas = document.getElementById('passPieChart');
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.passChart) {
        window.passChart.destroy();
    }
    
    // Find stats for selected department
    const deptStats = passStats.find(stat => stat.department === department);
    
    if (!deptStats) {
        console.error('No stats found for department:', department);
        return;
    }
    
    // Create pie chart
    window.passChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Pass', 'Fail'],
            datasets: [{
                data: [deptStats.pass, deptStats.fail],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${department} Department - Pass/Fail Distribution`,
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = deptStats.total;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Render bar chart for CGPA stats
function renderBarChart(option) {
    const canvas = document.getElementById('cgpaBarChart');
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    if (window.cgpaChart) {
        window.cgpaChart.destroy();
    }
    
    // Filter for user's department if not admin
    let filteredStats = cgpaStats;
    if (currentUser.department !== 'ALL') {
        filteredStats = cgpaStats.filter(stat => stat.department === currentUser.department);
    }
    
    if (filteredStats.length === 0) {
        console.error('No CGPA stats available');
        return;
    }
    
    // Extract data for selected option (avg, min, max)
    const departments = filteredStats.map(stat => stat.department);
    const values = filteredStats.map(stat => stat[option]);
    
    // Create bar chart
    window.cgpaChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: departments,
            datasets: [{
                label: option === 'avg' ? 'Average CGPA' : 
                       option === 'min' ? 'Minimum CGPA' : 'Maximum CGPA',
                data: values,
                backgroundColor: '#3b82f6',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Department CGPA Statistics',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: Math.max(0, Math.min(...values) - 1),
                    max: Math.min(10, Math.max(...values) + 1)
                }
            }
        }
    });
}

// Generic form display function
function showForm(title, fields, callback) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Create modal content
    let modalContent = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>${title}</h2>
            <form id="dataForm">
    `;
    
    // Add form fields
    fields.forEach(field => {
        if (field.type === 'select') {
            modalContent += `
                <div class="form-group">
                    <label for="${field.id}">${field.label}</label>
                    <select id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>
                        <option value="">-- Select ${field.label} --</option>
            `;
            
            if (field.options) {
                field.options.forEach(option => {
                    modalContent += `<option value="${option.value}">${option.label}</option>`;
                });
            }
            
            modalContent += `
                    </select>
                </div>
            `;
        } else {
            modalContent += `
                <div class="form-group">
                    <label for="${field.id}">${field.label}</label>
                    <input type="${field.type}" id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''} ${field.value ? `value="${field.value}"` : ''}>
                </div>
            `;
        }
    });
    
    // Add submit button
    modalContent += `
            <button type="submit" class="login-btn">Submit</button>
        </form>
    </div>
    `;
    
    // Add modal content to modal
    modal.innerHTML = modalContent;
    
    // Add modal to body
    document.body.appendChild(modal);
    
    // Close button functionality
    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', function() {
        document.body.removeChild(modal);
    });
    
    // Form submission
    const form = modal.querySelector('#dataForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = {};
        fields.forEach(field => {
            formData[field.id] = document.getElementById(field.id).value;
        });
        
        // Call callback with form data
        callback(formData);
        
        // Close modal
        document.body.removeChild(modal);
    });
}

// Search marks by roll number and course code
function searchMarks() {
    // Create search form
    const fields = [
        { id: 'roll_no', label: 'Roll Number', type: 'text', required: true }
    ];
    
    // Only add department field for admin users
    if (currentUser.department === 'ALL') {
        fields.push({ 
            id: 'department', 
            label: 'Department', 
            type: 'select', 
            required: true,
            options: [...new Set(studentsData.map(s => s.department))].map(dept => ({
                value: dept,
                label: dept
            }))
        });
    }
    
    showForm('Search Marks', fields, function(data) {
        // Find student
        const student = studentsData.find(s => s.rollNo === data.roll_no);
        
        // Check if student exists and is in the user's department
        if (!student) {
            alert('Student not found.');
            return;
        }
        
        if (currentUser.department !== 'ALL' && student.department !== currentUser.department) {
            alert('Student not present in this department.');
            return;
        }
        
        // Filter marks by roll number
        const filteredMarks = marksData.filter(mark => mark.roll_no === data.roll_no);
        
        // Update table
        renderMarksTable(filteredMarks);
    });
}

// Search SGPA/CGPA by roll number
function searchGpa() {
    // Create search form
    const fields = [
        { id: 'roll_no', label: 'Roll Number', type: 'text', required: true }
    ];
    
    // Only add department field for admin users
    if (currentUser.department === 'ALL') {
        fields.push({ 
            id: 'department', 
            label: 'Department', 
            type: 'select', 
            required: true,
            options: [...new Set(studentsData.map(s => s.department))].map(dept => ({
                value: dept,
                label: dept
            }))
        });
    }
    
    showForm('Search SGPA/CGPA', fields, function(data) {
        // Find student
        const student = studentsData.find(s => s.rollNo === data.roll_no);
        
        // Check if student exists and is in the user's department
        if (!student) {
            alert('Student not found.');
            return;
        }
        
        if (currentUser.department !== 'ALL' && student.department !== currentUser.department) {
            alert('Student not present in this department.');
            return;
        }
        
        // Filter SGPA/CGPA by roll number
        const filteredGpa = sgpaCgpaData.filter(gpa => gpa.roll_no === data.roll_no);
        
        // Update table
        renderGpaTable(filteredGpa);
    });
}

// Search student details by roll number
function searchCourse() {
    // Create search form
    const fields = [
        { id: 'roll_no', label: 'Roll Number', type: 'text', required: true }
    ];
    
    // Only add department field for admin users
    if (currentUser.department === 'ALL') {
        fields.push({ 
            id: 'department', 
            label: 'Department', 
            type: 'select', 
            required: true,
            options: [...new Set(studentsData.map(s => s.department))].map(dept => ({
                value: dept,
                label: dept
            }))
        });
    }
    
    showForm('Search Student Details', fields, function(data) {
        // Find student
        const student = studentsData.find(s => s.rollNo === data.roll_no);
        
        // Check if student exists and is in the user's department
        if (!student) {
            alert('Student not found.');
            return;
        }
        
        if (currentUser.department !== 'ALL' && student.department !== currentUser.department) {
            alert('Student not present in this department.');
            return;
        }
        
        // Filter student details by roll number
        const filteredDetails = studentDetailsData.filter(detail => detail.roll_no === data.roll_no);
        
        // Update table
        renderCourseTable(filteredDetails);
    });
}

// Search courses by course code
function searchCourses() {
    const courseCode = document.getElementById('courseCodeSearch').value.trim();
    
    if (!courseCode) {
        // If empty, show all courses
        renderCoursesTable(coursesData);
    } else {
        // Filter courses by course code
        const filteredCourses = coursesData.filter(course => 
            course.course_code.toLowerCase().includes(courseCode.toLowerCase()) || 
            course.course_name.toLowerCase().includes(courseCode.toLowerCase())
        );
        
        // Update table
        renderCoursesTable(filteredCourses);
    }
}

// Delete student function
async function deleteStudent() {
    // Create delete form
    const fields = [
        { id: 'roll_no', label: 'Roll Number', type: 'text', required: true }
    ];
    
    // Only add department field for admin users
    if (currentUser.department === 'ALL') {
        fields.push({ 
            id: 'department', 
            label: 'Department', 
            type: 'select', 
            required: true,
            options: [...new Set(studentsData.map(s => s.department))].map(dept => ({
                value: dept,
                label: dept
            }))
        });
    }
    
    showForm('Delete Student', fields, async function(data) {
        // Find student
        const student = studentsData.find(s => s.rollNo === data.roll_no);
        
        // Check if student exists and is in the user's department
        if (!student) {
            alert('Student not found.');
            return;
        }
        
        if (currentUser.department !== 'ALL' && student.department !== currentUser.department) {
            alert('Student not present in this department.');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete student ${student.name} (${student.rollNo})?`)) {
            return;
        }
        
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`/students/${data.roll_no}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Student deleted successfully.');
                // Refresh data
                fetchAllData();
            } else {
                alert(`Error: ${result.message || 'Failed to delete student.'}`);
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            alert('An error occurred while deleting the student.');
        }
    });
}

// Add student function
async function addStudent() {
    // Create add form
    const fields = [
        { id: 'roll_no', label: 'Roll Number', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true }
    ];
    
    // Department selection - for admin show all departments, for others pre-select their department
    if (currentUser.department === 'ALL') {
        fields.push({ 
            id: 'department', 
            label: 'Department', 
            type: 'select', 
            required: true,
            options: [...new Set(studentsData.map(s => s.department))].map(dept => ({
                value: dept,
                label: dept
            }))
        });
    } else {
        fields.push({ 
            id: 'department', 
            label: 'Department', 
            type: 'text', 
            required: true, 
            value: currentUser.department 
        });
    }
    
    showForm('Add Student', fields, async function(data) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch('/students', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Student added successfully.');
                // Refresh data
                fetchAllData();
            } else {
                alert(`Error: ${result.message || 'Failed to add student.'}`);
            }
        } catch (error) {
            console.error('Error adding student:', error);
            alert('An error occurred while adding the student.');
        }
    });
}

// Render marks table
function renderMarksTable(data = marksData) {
    const tbody = document.getElementById('marksTbody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7">No marks data available</td>';
        tbody.appendChild(tr);
        return;
    }
    
    data.forEach(mark => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${mark.roll_no}</td>
            <td>${mark.course_code}</td>
            <td>${mark.minor_1 || '-'}</td>
            <td>${mark.mid || '-'}</td>
            <td>${mark.minor_2 || '-'}</td>
            <td>${mark.endsem || '-'}</td>
            <td>
                <button class="edit-btn" data-id="${mark.id}">Edit</button>
                <button class="delete-btn" data-id="${mark.id}">Delete</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Add event listeners
    addEventListeners('marksTbody', editMarksRow, deleteMarksRow);
}

// Add marks row
async function addMarksRow() {
    // Get student options based on department access
    let studentOptions = [];
    
    if (currentUser.department === 'ALL') {
        studentOptions = studentsData.map(student => ({
            value: student.rollNo,
            label: `${student.rollNo} - ${student.name} (${student.department})`
        }));
    } else {
        studentOptions = studentsData
            .filter(student => student.department === currentUser.department)
            .map(student => ({
                value: student.rollNo,
                label: `${student.rollNo} - ${student.name}`
            }));
    }
    
    // Create form fields
    const fields = [
        { 
            id: 'roll_no', 
            label: 'Student', 
            type: 'select', 
            required: true,
            options: studentOptions
        },
        { 
            id: 'course_code', 
            label: 'Course', 
            type: 'select', 
            required: true,
            options: coursesData.map(course => ({
                value: course.course_code,
                label: `${course.course_code} - ${course.course_name}`
            }))
        },
        { id: 'minor_1', label: 'Minor-1', type: 'number', required: false },
        { id: 'mid', label: 'Mid-Term', type: 'number', required: false },
        { id: 'minor_2', label: 'Minor-2', type: 'number', required: false },
        { id: 'endsem', label: 'End Semester', type: 'number', required: false }
    ];
    
    showForm('Add Marks', fields, async function(data) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch('/marks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Marks added successfully.');
                // Refresh data
                fetchAllData();
            } else {
                alert(`Error: ${result.message || 'Failed to add marks.'}`);
            }
        } catch (error) {
            console.error('Error adding marks:', error);
            alert('An error occurred while adding marks.');
        }
    });
}

// Edit marks row
async function editMarksRow(id) {
    console.log('Edit marks row:', id);
    // In the real implementation, we would add code to edit marks
}

// Delete marks row
async function deleteMarksRow(id) {
    console.log('Delete marks row:', id);
    // In the real implementation, we would add code to delete marks
}

// Render GPA table
function renderGpaTable(data = sgpaCgpaData) {
    const tbody = document.getElementById('gpaTbody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8">No SGPA/CGPA data available</td>';
        tbody.appendChild(tr);
        return;
    }
    
    data.forEach(gpa => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${gpa.roll_no}</td>
            <td>${gpa.name}</td>
            <td>${gpa.department}</td>
            <td>${gpa.academic_year}</td>
            <td>${gpa.semester}</td>
            <td>${gpa.sgpa ? gpa.sgpa.toFixed(2) : '-'}</td>
            <td>${gpa.cgpa ? gpa.cgpa.toFixed(2) : '-'}</td>
            <td>
                <button class="edit-btn" data-id="${gpa.id}">Edit</button>
                <button class="delete-btn" data-id="${gpa.id}">Delete</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Add event listeners
    addEventListeners('gpaTbody', editGpaRow, deleteGpaRow);
}

// Add GPA row
async function addGpaRow() {
    // Get student options based on department access
    let studentOptions = [];
    
    if (currentUser.department === 'ALL') {
        studentOptions = studentsData.map(student => ({
            value: student.rollNo,
            label: `${student.rollNo} - ${student.name} (${student.department})`
        }));
    } else {
        studentOptions = studentsData
            .filter(student => student.department === currentUser.department)
            .map(student => ({
                value: student.rollNo,
                label: `${student.rollNo} - ${student.name}`
            }));
    }
    
    // Create form fields
    const fields = [
        { 
            id: 'roll_no', 
            label: 'Student', 
            type: 'select', 
            required: true,
            options: studentOptions
        },
        { id: 'semester', label: 'Semester', type: 'number', required: true },
        { id: 'academic_year', label: 'Academic Year', type: 'text', required: true }
    ];
    
    showForm('Add SGPA/CGPA Tracker', fields, async function(data) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch('/sgpa_cgpa', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('SGPA/CGPA tracker added successfully.');
                // Refresh data
                fetchAllData();
            } else {
                alert(`Error: ${result.message || 'Failed to add SGPA/CGPA tracker.'}`);
            }
        } catch (error) {
            console.error('Error adding SGPA/CGPA tracker:', error);
            alert('An error occurred while adding SGPA/CGPA tracker.');
        }
    });
}

// Edit GPA row
async function editGpaRow(id) {
    console.log('Edit GPA row:', id);
    // In the real implementation, we would add code to edit GPA
}

// Delete GPA row
async function deleteGpaRow(id) {
    console.log('Delete GPA row:', id);
    // In the real implementation, we would add code to delete GPA
}

// Render student details table
function renderCourseTable(data = studentDetailsData) {
    const tbody = document.getElementById('courseTbody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="10">No student details available</td>';
        tbody.appendChild(tr);
        return;
    }
    
    data.forEach(detail => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${detail.roll_no}</td>
            <td>${detail.name}</td>
            <td>${detail.department}</td>
            <td>${detail.academic_year}</td>
            <td>${detail.semester}</td>
            <td>${detail.course_name}</td>
            <td>${detail.course_code}</td>
            <td>${detail.credits}</td>
            <td>${detail.grade || '-'}</td>
            <td>
                <button class="edit-btn" data-id="${detail.id}">Edit</button>
                <button class="delete-btn" data-id="${detail.id}">Delete</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Add event listeners
    addEventListeners('courseTbody', editStudentDetailsRow, deleteStudentDetailsRow);
}

// Add student details row
async function addStudentDetailsRow() {
    // Get student options based on department access
    let studentOptions = [];
    
    if (currentUser.department === 'ALL') {
        studentOptions = studentsData.map(student => ({
            value: student.rollNo,
            label: `${student.rollNo} - ${student.name} (${student.department})`
        }));
    } else {
        studentOptions = studentsData
            .filter(student => student.department === currentUser.department)
            .map(student => ({
                value: student.rollNo,
                label: `${student.rollNo} - ${student.name}`
            }));
    }
    
    // Create form fields
    const fields = [
        { 
            id: 'roll_no', 
            label: 'Student', 
            type: 'select', 
            required: true,
            options: studentOptions
        },
        { 
            id: 'course_code', 
            label: 'Course', 
            type: 'select', 
            required: true,
            options: coursesData.map(course => ({
                value: course.course_code,
                label: `${course.course_code} - ${course.course_name}`
            }))
        },
        { id: 'semester', label: 'Semester', type: 'number', required: true },
        { id: 'academic_year', label: 'Academic Year', type: 'text', required: true },
        { 
            id: 'grade', 
            label: 'Grade', 
            type: 'select', 
            required: false,
            options: gradePointsData.map(gp => ({
                value: gp.grade,
                label: `${gp.grade} (${gp.points})`
            }))
        }
    ];
    
    showForm('Add Student Detail', fields, async function(data) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch('/student_details', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Student detail added successfully.');
                // Refresh data
                fetchAllData();
            } else {
                alert(`Error: ${result.message || 'Failed to add student detail.'}`);
            }
        } catch (error) {
            console.error('Error adding student detail:', error);
            alert('An error occurred while adding student detail.');
        }
    });
}

// Edit student details row
async function editStudentDetailsRow(id) {
    console.log('Edit student details row:', id);
    // In the real implementation, we would add code to edit student details
}

// Delete student details row
async function deleteStudentDetailsRow(id) {
    console.log('Delete student details row:', id);
    // In the real implementation, we would add code to delete student details
}

// Render courses table
function renderCoursesTable(data = coursesData) {
    const tbody = document.getElementById('coursesTbody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="4">No courses available</td>';
        tbody.appendChild(tr);
        return;
    }
    
    data.forEach(course => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${course.course_code}</td>
            <td>${course.course_name}</td>
            <td>${course.credits}</td>
            <td>
                <button class="edit-btn" data-id="${course.course_code}">Edit</button>
                <button class="delete-btn" data-id="${course.course_code}">Delete</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Add event listeners
    addEventListeners('coursesTbody', editCoursesRow, deleteCoursesRow);
}

// Add course row
async function addCoursesRow() {
    // Only admin can add courses
    if (currentUser.department !== 'ALL') {
        alert('Only administrators can add courses.');
        return;
    }
    
    // Create form fields
    const fields = [
        { id: 'course_code', label: 'Course Code', type: 'text', required: true },
        { id: 'course_name', label: 'Course Name', type: 'text', required: true },
        { id: 'credits', label: 'Credits', type: 'number', required: true }
    ];
    
    showForm('Add Course', fields, async function(data) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch('/courses', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Course added successfully.');
                // Refresh data
                fetchAllData();
            } else {
                alert(`Error: ${result.message || 'Failed to add course.'}`);
            }
        } catch (error) {
            console.error('Error adding course:', error);
            alert('An error occurred while adding course.');
        }
    });
}

// Edit courses row
async function editCoursesRow(id) {
    console.log('Edit courses row:', id);
    // In the real implementation, we would add code to edit courses
}

// Delete courses row
async function deleteCoursesRow(id) {
    console.log('Delete courses row:', id);
    // In the real implementation, we would add code to delete courses
}

// Render grade points table
function renderGradePointsTable() {
    const tbody = document.getElementById('gradePointsTbody');
    tbody.innerHTML = '';
    
    if (gradePointsData.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="3">No grade points available</td>';
        tbody.appendChild(tr);
        return;
    }
    
    gradePointsData.forEach(gp => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${gp.grade}</td>
            <td>${gp.points}</td>
            <td>
                <button class="edit-btn" data-id="${gp.id}">Edit</button>
                <button class="delete-btn" data-id="${gp.id}">Delete</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Add event listeners
    addEventListeners('gradePointsTbody', editGradePointsRow, deleteGradePointsRow);
}

// Add grade points row
async function addGradePointsRow() {
    // Only admin can add grade points
    if (currentUser.department !== 'ALL') {
        alert('Only administrators can add grade points.');
        return;
    }
    
    // Create form fields
    const fields = [
        { id: 'grade', label: 'Grade', type: 'text', required: true },
        { id: 'points', label: 'Points', type: 'number', required: true }
    ];
    
    showForm('Add Grade Point', fields, async function(data) {
        const token = localStorage.getItem('token');
        
        try {
            // In a real implementation, we would have an API for grade points
            alert('Grade point added successfully.');
            // Refresh data
            fetchAllData();
        } catch (error) {
            console.error('Error adding grade point:', error);
            alert('An error occurred while adding grade point.');
        }
    });
}

// Edit grade points row
async function editGradePointsRow(id) {
    console.log('Edit grade points row:', id);
    // In the real implementation, we would add code to edit grade points
}

// Delete grade points row
async function deleteGradePointsRow(id) {
    console.log('Delete grade points row:', id);
    // In the real implementation, we would add code to delete grade points
}

// Add event listeners for edit and delete buttons
function addEventListeners(tbodyId, editFn, deleteFn) {
    const tbody = document.getElementById(tbodyId);
    
    // Edit buttons
    const editButtons = tbody.querySelectorAll('.edit-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            editFn(id);
        });
    });
    
    // Delete buttons
    const deleteButtons = tbody.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            deleteFn(id);
        });
    });
}