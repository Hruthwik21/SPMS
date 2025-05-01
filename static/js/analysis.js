// Global variables
let studentsData = [];
let sgpaCgpaData = [];
let coursesData = [];
let currentUser = { username: '', department: '' };

// Check if user is authenticated on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();

    // Logout button
    document.querySelector('a[href="#logout"]').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });

    // Search student button
    document.getElementById('searchStudent').addEventListener('click', searchStudent);

    // CGPA change calculation
    setupAnalysisPage();
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
    
    // Load data
    fetchData();
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
    
    // If not admin, hide department selection since we'll auto-calculate for user's department
    if (currentUser.department !== 'ALL') {
        const departmentSelect = document.getElementById('departmentSelect');
        departmentSelect.style.display = 'none';
        document.querySelector('label[for="departmentSelect"]').style.display = 'none';
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
async function fetchData() {
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
        
        // Fetch SGPA/CGPA
        const sgpaCgpaResponse = await fetch('/sgpa_cgpa', { headers });
        sgpaCgpaData = await sgpaCgpaResponse.json();
        
        // Fetch courses
        const coursesResponse = await fetch('/courses', { headers });
        coursesData = await coursesResponse.json();
        
        // After fetching data, set up the analysis page
        setupAnalysisPage();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Set up analysis page elements
function setupAnalysisPage() {
    populateDepartmentSelect();
    populateCourseSelect();
    
    // Department select event listener
    document.getElementById('departmentSelect').addEventListener('change', function() {
        if (this.value) {
            calculateDepartmentCgpaChange(this.value);
        } else {
            document.getElementById('departmentCgpaChange').textContent = '';
            document.getElementById('departmentCgpaChange').className = 'cgpa-change-box';
        }
    });
    
    // Course select event listener
    document.getElementById('courseCodeSelect').addEventListener('change', function() {
        if (this.value) {
            calculateCourseCgpaChange(this.value);
        } else {
            document.getElementById('courseCgpaChange').textContent = '';
            document.getElementById('courseCgpaChange').className = 'cgpa-change-box';
        }
    });
    
    // If user is not admin, automatically calculate CGPA change for their department
    if (currentUser.department !== 'ALL') {
        calculateDepartmentCgpaChange(currentUser.department);
    }
}

// Populate department select
function populateDepartmentSelect() {
    const departmentSelect = document.getElementById('departmentSelect');
    
    // Clear existing options
    departmentSelect.innerHTML = '<option value="">-- Select Department --</option>';
    
    // Get unique departments from students
    const departments = [...new Set(studentsData.map(s => s.department))];
    
    // For admin, show all departments
    if (currentUser.department === 'ALL') {
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    } else {
        // For non-admin, only show and select their department
        const option = document.createElement('option');
        option.value = currentUser.department;
        option.textContent = currentUser.department;
        option.selected = true;
        departmentSelect.appendChild(option);
    }
}

// Populate course select
function populateCourseSelect() {
    const courseSelect = document.getElementById('courseCodeSelect');
    
    // Clear existing options
    courseSelect.innerHTML = '<option value="">-- Select Course Code --</option>';
    
    // Add course options
    coursesData.forEach(course => {
        const option = document.createElement('option');
        option.value = course.course_code;
        option.textContent = `${course.course_code} - ${course.course_name}`;
        courseSelect.appendChild(option);
    });
}

// Calculate CGPA change for a department
async function calculateDepartmentCgpaChange(selectedDept) {
    // Filter SGPA/CGPA data by department
    const deptData = sgpaCgpaData.filter(data => {
        const student = studentsData.find(s => s.rollNo === data.roll_no);
        return student && student.department === selectedDept;
    });
    
    if (deptData.length === 0) {
        document.getElementById('departmentCgpaChange').textContent = 'No data available for this department';
        document.getElementById('departmentCgpaChange').className = 'cgpa-change-box';
        return;
    }
    
    // Group by academic year and calculate average CGPA
    const cgpaByYear = {};
    
    deptData.forEach(data => {
        if (!data.cgpa) return;
        
        if (!cgpaByYear[data.academic_year]) {
            cgpaByYear[data.academic_year] = {
                total: 0,
                count: 0
            };
        }
        
        cgpaByYear[data.academic_year].total += data.cgpa;
        cgpaByYear[data.academic_year].count++;
    });
    
    // Calculate average CGPA for each year
    Object.keys(cgpaByYear).forEach(year => {
        cgpaByYear[year].avg = cgpaByYear[year].total / cgpaByYear[year].count;
    });
    
    // Sort years chronologically
    const sortedYears = Object.keys(cgpaByYear).sort();
    
    if (sortedYears.length < 2) {
        document.getElementById('departmentCgpaChange').textContent = 'Need data from at least two academic years to calculate change';
        document.getElementById('departmentCgpaChange').className = 'cgpa-change-box';
        return;
    }
    
    // Calculate change between latest two years
    const latestYear = sortedYears[sortedYears.length - 1];
    const previousYear = sortedYears[sortedYears.length - 2];
    
    const latestAvg = cgpaByYear[latestYear].avg;
    const previousAvg = cgpaByYear[previousYear].avg;
    const change = latestAvg - previousAvg;
    const percentChange = (change / previousAvg) * 100;
    
    // Display result
    const resultBox = document.getElementById('departmentCgpaChange');
    
    if (change > 0) {
        resultBox.className = 'cgpa-change-box positive-change';
        resultBox.innerHTML = `<span>↑</span> Average CGPA increased by ${change.toFixed(2)} (${percentChange.toFixed(1)}%) from ${previousYear} to ${latestYear}`;
    } else if (change < 0) {
        resultBox.className = 'cgpa-change-box negative-change';
        resultBox.innerHTML = `<span>↓</span> Average CGPA decreased by ${Math.abs(change).toFixed(2)} (${Math.abs(percentChange).toFixed(1)}%) from ${previousYear} to ${latestYear}`;
    } else {
        resultBox.className = 'cgpa-change-box';
        resultBox.textContent = `No change in average CGPA from ${previousYear} to ${latestYear}`;
    }
}

// Calculate CGPA change for a course
function calculateCourseCgpaChange(courseCode) {
    // Implementation similar to department CGPA change
    document.getElementById('courseCgpaChange').textContent = 'Course analysis coming soon...';
    document.getElementById('courseCgpaChange').className = 'cgpa-change-box';
}

// Search student
function searchStudent() {
    const rollNo = document.getElementById('rollNoSearch').value.trim();
    
    if (!rollNo) {
        alert('Please enter a Roll No to search');
        return;
    }
    
    // Find student
    const student = studentsData.find(s => s.rollNo === rollNo);
    
    if (!student) {
        alert('Student not found');
        return;
    }
    
    // Check if student is in user's department (for non-admin users)
    if (currentUser.department !== 'ALL' && student.department !== currentUser.department) {
        alert('Student not present in this department');
        return;
    }
    
    // Get student GPA data
    const studentGpaData = sgpaCgpaData.filter(data => data.roll_no === rollNo);
    
    // Display student details
    displayStudentDetails(student, studentGpaData);
}

// Display student details
function displayStudentDetails(student, gpaData) {
    const studentForm = document.getElementById('studentForm');
    
    let html = `
        <div>
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${student.name}</p>
            <p><strong>Roll No:</strong> ${student.rollNo}</p>
            <p><strong>Department:</strong> ${student.department}</p>
        </div>
        <div>
            <h3>GPA Information</h3>
    `;
    
    if (gpaData.length === 0) {
        html += '<p>No GPA data available for this student</p>';
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th>Academic Year</th>
                        <th>Semester</th>
                        <th>SGPA</th>
                        <th>CGPA</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Sort data by semester
        gpaData.sort((a, b) => a.semester - b.semester);
        
        gpaData.forEach(data => {
            html += `
                <tr>
                    <td>${data.academic_year}</td>
                    <td>${data.semester}</td>
                    <td>${data.sgpa ? data.sgpa.toFixed(2) : '-'}</td>
                    <td>${data.cgpa ? data.cgpa.toFixed(2) : '-'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
    }
    
    html += '</div>';
    
    studentForm.innerHTML = html;
}