document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    const userInfoStr = localStorage.getItem('user_info');
    
    if (!token || !userInfoStr) {
        // Redirect to login if not logged in
        window.location.href = 'login.html';
        return;
    }
    
    // Parse user info
    let userInfo;
    try {
        userInfo = JSON.parse(userInfoStr);
    } catch (error) {
        console.error('Error parsing user info:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'login.html';
        return;
    }
    
    // Create and add department badge
    const header = document.querySelector('header');
    const departmentBadge = document.createElement('div');
    departmentBadge.className = 'department-badge';
    departmentBadge.innerHTML = `
        <span>Department: ${userInfo.department === 'ALL' ? 'Administrator (All Departments)' : userInfo.department}</span>
        <span>User: ${userInfo.username}</span>
    `;
    header.appendChild(departmentBadge);
    
    // Add logout listener
    document.querySelector('a[href="#logout"]').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        window.location.href = 'login.html';
    });

    const rollNoSearch = document.getElementById('rollNoSearch');
    const searchStudentButton = document.getElementById('searchStudent');
    const studentDetails = document.getElementById('studentDetails');
    const studentForm = document.getElementById('studentForm');
    const departmentSelect = document.getElementById('departmentSelect');
    const courseCodeSelect = document.getElementById('courseCodeSelect');
    const departmentCgpaChange = document.getElementById('departmentCgpaChange');
    const courseCgpaChange = document.getElementById('courseCgpaChange');
    
    // Hide departmentSelect container for non-admins, show direct department analysis
    const overallAnalysis = document.querySelector('.overall-analysis');
    if (userInfo.department !== 'ALL') {
        // Hide department selection for non-admin users
        departmentSelect.parentElement.style.display = 'none';
        
        // Add heading for department analysis
        const deptHeading = document.createElement('h3');
        deptHeading.textContent = `${userInfo.department} Department CGPA Change`;
        deptHeading.style.color = '#fff';
        deptHeading.style.marginBottom = '15px';
        departmentCgpaChange.parentElement.insertBefore(deptHeading, departmentCgpaChange);
        
        // Load department CGPA change immediately for the user's department
        await calculateDepartmentCgpaChange(userInfo.department);
    }

    // Grade points mapping for course grades
    const gradePointsMap = {
        'EX': 10,
        'A': 9,
        'B': 8,
        'C': 7,
        'D': 6,
        'E': 5,
        'P': 4,
        'F': 0,
        'R': 0
    };

    // Populate course code dropdown
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Fetch all students to get departments (for admin users)
        if (userInfo.department === 'ALL') {
            const studentsResponse = await fetch('http://localhost:3000/students', {
                headers
            });
            
            if (!studentsResponse.ok) {
                if (studentsResponse.status === 401) {
                    alert('Session expired. Please login again.');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error('Error fetching students');
            }
            
            const students = await studentsResponse.json();
            const departments = [...new Set(students.map(student => student.department).filter(Boolean))].sort();
            
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                departmentSelect.appendChild(option);
            });
            
            // Add listener for department selection (only for admin)
            departmentSelect.addEventListener('change', async () => {
                const selectedDept = departmentSelect.value;
                if (!selectedDept) {
                    departmentCgpaChange.innerHTML = '';
                    return;
                }
                
                await calculateDepartmentCgpaChange(selectedDept);
            });
        }

        // Fetch all student details to get course codes
        const detailsResponse = await fetch('http://localhost:3000/student_details', {
            headers
        });
        
        if (!detailsResponse.ok) {
            if (detailsResponse.status === 401) {
                alert('Session expired. Please login again.');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Error fetching student details');
        }
        
        const details = await detailsResponse.json();
        const courseCodes = [...new Set(details.map(detail => detail.course_code).filter(Boolean))].sort();
        
        courseCodes.forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            courseCodeSelect.appendChild(option);
        });

        // Course code selection handler
        courseCodeSelect.addEventListener('change', async () => {
            const selectedCourse = courseCodeSelect.value;
            if (!selectedCourse) {
                courseCgpaChange.innerHTML = '';
                return;
            }

            try {
                // Fetch student details for the selected course
                const detailsResponse = await fetch('http://localhost:3000/student_details', {
                    headers
                });
                
                if (!detailsResponse.ok) throw new Error('Error fetching student details');
                const allDetails = await detailsResponse.json();

                // Get academic years
                const years = [...new Set(allDetails.map(row => row.academic_year))].sort();
                if (years.length < 2) {
                    courseCgpaChange.innerHTML = '<p>Insufficient academic years for grade comparison.</p>';
                    return;
                }

                const latestYear = years[years.length - 1];
                const previousYear = years[years.length - 2];

                // Filter details by course code and department if not admin
                let filteredDetails = allDetails.filter(detail => detail.course_code === selectedCourse);
                if (userInfo.department !== 'ALL') {
                    filteredDetails = filteredDetails.filter(detail => detail.department === userInfo.department);
                }

                // Calculate average grade points for latest and previous years
                const latestCourseDetails = filteredDetails.filter(detail => detail.academic_year === latestYear);
                const previousCourseDetails = filteredDetails.filter(detail => detail.academic_year === previousYear);

                let latestGradePointsSum = 0;
                let latestGradePointsCount = 0;
                let previousGradePointsSum = 0;
                let previousGradePointsCount = 0;

                // Latest year grades
                for (const detail of latestCourseDetails) {
                    const grade = detail.grade?.toUpperCase();
                    if (grade && grade in gradePointsMap) {
                        latestGradePointsSum += gradePointsMap[grade];
                        latestGradePointsCount++;
                    }
                }

                // Previous year grades
                for (const detail of previousCourseDetails) {
                    const grade = detail.grade?.toUpperCase();
                    if (grade && grade in gradePointsMap) {
                        previousGradePointsSum += gradePointsMap[grade];
                        previousGradePointsCount++;
                    }
                }

                if (latestGradePointsCount === 0 || previousGradePointsCount === 0) {
                    courseCgpaChange.innerHTML = '<p>No valid grade data for comparison in this course.</p>';
                    return;
                }

                const latestAvgGradePoints = (latestGradePointsSum / latestGradePointsCount).toFixed(2);
                const previousAvgGradePoints = (previousGradePointsSum / previousGradePointsCount).toFixed(2);
                const avgGradeDiff = (latestAvgGradePoints - previousAvgGradePoints).toFixed(2);
                const avgPercentChange = ((avgGradeDiff / previousAvgGradePoints) * 100).toFixed(2);
                const changeText = avgGradeDiff >= 0 ? 'Rise' : 'Fall';
                const percentChangeText = avgPercentChange >= 0 ? `+${avgPercentChange}%` : `${avgPercentChange}%`;

                courseCgpaChange.innerHTML = `
                    <h4>Average Grade Points Change for Course ${selectedCourse}</h4>
                    <p>${changeText}: ${avgGradeDiff >= 0 ? '+' : ''}${avgGradeDiff} points</p>
                    <p>Percentage Change: ${percentChangeText}</p>
                    <p>Latest Year (${latestYear}): ${latestAvgGradePoints}</p>
                    <p>Previous Year (${previousYear}): ${previousAvgGradePoints}</p>
                `;
            } catch (error) {
                console.error('Error calculating course grade points change:', error);
                courseCgpaChange.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
                
                if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                    alert('Session expired. Please login again.');
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                    window.location.href = 'login.html';
                }
            }
        });
        
        // If user is not admin, automatically calculate their department's CGPA change
        if (userInfo.department !== 'ALL') {
            await calculateDepartmentCgpaChange(userInfo.department);
        }
    } catch (error) {
        console.error('Error populating dropdowns:', error);
        departmentCgpaChange.innerHTML = `<p style="color: red;">Error loading departments: ${error.message}</p>`;
        courseCgpaChange.innerHTML = `<p style="color: red;">Error loading course codes: ${error.message}</p>`;
        
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
            alert('Session expired. Please login again.');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            window.location.href = 'login.html';
        }
    }

    // Function to calculate department CGPA change
    async function calculateDepartmentCgpaChange(selectedDept) {
        try {
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
            
            // Fetch all students in the selected department
            const studentsResponse = await fetch('http://localhost:3000/students', {
                headers
            });
            
            if (!studentsResponse.ok) throw new Error('Error fetching students');
            const students = await studentsResponse.json();
            const deptStudents = students
                .filter(student => student.department === selectedDept)
                .map(student => student.rollNo);

            if (deptStudents.length === 0) {
                departmentCgpaChange.innerHTML = '<p>No students found in this department.</p>';
                return;
            }

            // Fetch student details and SGPA/CGPA
            const detailsResponse = await fetch('http://localhost:3000/student_details', {
                headers
            });
            const allDetails = await detailsResponse.json();
            
            const sgpaCgpaResponse = await fetch('http://localhost:3000/sgpa_cgpa', {
                headers
            });
            const allSgpaCgpa = await sgpaCgpaResponse.json();

            // Get academic years
            const years = [...new Set(allDetails.map(row => row.academic_year))].sort();
            if (years.length < 2) {
                departmentCgpaChange.innerHTML = '<p>Insufficient academic years for CGPA comparison.</p>';
                return;
            }

            const latestYear = years[years.length - 1];
            const previousYear = years[years.length - 2];

            // Calculate average CGPA for latest and previous years
            let latestCgpaSum = 0;
            let latestCgpaCount = 0;
            let previousCgpaSum = 0;
            let previousCgpaCount = 0;

            for (const rollNo of deptStudents) {
                const studentDetails = allDetails.filter(row => row.roll_no === rollNo);
                const studentSgpaCgpa = allSgpaCgpa.filter(row => row.roll_no === rollNo);

                // Latest year CGPA
                const latestYearDetails = studentDetails.filter(row => row.academic_year === latestYear);
                if (latestYearDetails.length > 0) {
                    const latestSemester = Math.max(...latestYearDetails.map(row => row.semester));
                    const latestCgpa = studentSgpaCgpa.find(row => row.semester === latestSemester)?.cgpa || null;
                    if (latestCgpa !== null) {
                        latestCgpaSum += latestCgpa;
                        latestCgpaCount++;
                    }
                }

                // Previous year CGPA
                const previousYearDetails = studentDetails.filter(row => row.academic_year === previousYear);
                if (previousYearDetails.length > 0) {
                    const previousSemester = Math.max(...previousYearDetails.map(row => row.semester));
                    const previousCgpa = studentSgpaCgpa.find(row => row.semester === previousSemester)?.cgpa || null;
                    if (previousCgpa !== null) {
                        previousCgpaSum += previousCgpa;
                        previousCgpaCount++;
                    }
                }
            }

            if (latestCgpaCount === 0 || previousCgpaCount === 0) {
                departmentCgpaChange.innerHTML = '<p>No valid CGPA data for comparison in this department.</p>';
                return;
            }

            const latestAvgCgpa = (latestCgpaSum / latestCgpaCount).toFixed(2);
            const previousAvgCgpa = (previousCgpaSum / previousCgpaCount).toFixed(2);
            const avgCgpaDiff = (latestAvgCgpa - previousAvgCgpa).toFixed(2);
            const avgPercentChange = ((avgCgpaDiff / previousAvgCgpa) * 100).toFixed(2);
            const changeText = avgCgpaDiff >= 0 ? 'Rise' : 'Fall';
            const percentChangeText = avgPercentChange >= 0 ? `+${avgPercentChange}%` : `${avgPercentChange}%`;

            departmentCgpaChange.innerHTML = `
                <h4>Average CGPA Change for ${selectedDept}</h4>
                <p>${changeText}: ${avgCgpaDiff >= 0 ? '+' : ''}${avgCgpaDiff} points</p>
                <p>Percentage Change: ${percentChangeText}</p>
                <p>Latest Year (${latestYear}): ${latestAvgCgpa}</p>
                <p>Previous Year (${previousYear}): ${previousAvgCgpa}</p>
            `;
        } catch (error) {
            console.error('Error calculating department CGPA change:', error);
            departmentCgpaChange.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
            
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                alert('Session expired. Please login again.');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                window.location.href = 'login.html';
            }
        }
    }

    searchStudentButton.addEventListener('click', async () => {
        const rollNo = rollNoSearch.value.trim();
        if (!rollNo) {
            studentDetails.style.display = 'block';
            studentForm.innerHTML = '<p style="color: red;">Please enter a Roll No.</p>';
            return;
        }

        if (!/^\d+$/.test(rollNo)) {
            studentDetails.style.display = 'block';
            studentForm.innerHTML = '<p style="color: red;">Please enter a valid numeric Roll No.</p>';
            return;
        }

        studentDetails.style.display = 'block';
        studentForm.innerHTML = '<p>Loading...</p>';
        console.log(`Searching for Roll No: ${rollNo}`);

        try {
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
            
            const studentResponse = await fetch(`http://localhost:3000/students/${rollNo}`, {
                headers
            });
            
            if (!studentResponse.ok) {
                if (studentResponse.status === 404) {
                    studentDetails.style.display = 'block';
                    studentForm.innerHTML = '<p style="color: red;">Roll No is not found.</p>';
                    console.log(`Roll No ${rollNo} not found (404)`);
                    return;
                } else if (studentResponse.status === 403) {
                    // Department access error
                    studentDetails.style.display = 'block';
                    studentForm.innerHTML = '<p style="color: red;">This student is not in your department. Access denied.</p>';
                    console.log(`Access denied for Roll No ${rollNo} - different department (403)`);
                    return;
                }
                throw new Error(`Error fetching student data (Status: ${studentResponse.status})`);
            }
            
            const student = await studentResponse.json();

            // Check if student department matches user's department (redundant but safe)
            if (userInfo.department !== 'ALL' && student.department !== userInfo.department) {
                studentDetails.style.display = 'block';
                studentForm.innerHTML = '<p style="color: red;">This student is not in your department. Access denied.</p>';
                return;
            }

            const detailsResponse = await fetch(`http://localhost:3000/student_details`, {
                headers
            });
            const allDetails = await detailsResponse.json();
            const studentDetailsData = allDetails
                .filter(row => row.roll_no === rollNo)
                .sort((a, b) => a.semester - b.semester);

            const marksResponse = await fetch(`http://localhost:3000/marks`, {
                headers
            });
            const allMarks = await marksResponse.json();
            const studentMarks = allMarks.filter(row => row.roll_no === rollNo);

            const sgpaCgpaResponse = await fetch(`http://localhost:3000/sgpa_cgpa`, {
                headers
            });
            const allSgpaCgpa = await sgpaCgpaResponse.json();
            const studentSgpaCgpa = allSgpaCgpa
                .filter(row => row.roll_no === rollNo)
                .sort((a, b) => a.semester - b.semester);

            if (studentDetailsData.length === 0 || studentSgpaCgpa.length === 0) {
                studentForm.innerHTML = `
                    <div class="student-info">
                        <h3>Student Information</h3>
                        <p><strong>Roll No:</strong> ${student.roll_no}</p>
                        <p><strong>Name:</strong> ${student.name}</p>
                        <p><strong>Department:</strong> ${student.department}</p>
                        <p style="color: red;">No academic data found for this student.</p>
                    </div>
                `;
                return;
            }

            // Prepare data for chart
            const semesters = [...new Set(studentSgpaCgpa.map(row => row.semester))].sort((a, b) => a - b);
            const sgpaData = semesters.map(sem => {
                const record = studentSgpaCgpa.find(row => row.semester === sem);
                return record ? record.sgpa : null;
            });
            const cgpaData = semesters.map(sem => {
                const record = studentSgpaCgpa.find(row => row.semester === sem);
                return record ? record.cgpa : null;
            });

            // Render student info and chart
            studentForm.innerHTML = `
                <div class="student-info-graph">
                    <div class="student-info">
                        <h3>Student Information</h3>
                        <p><strong>Roll No:</strong> ${student.roll_no}</p>
                        <p><strong>Name:</strong> ${student.name}</p>
                        <p><strong>Department:</strong> ${student.department}</p>
                        
                        <h3>Courses Taken</h3>
                        <table class="details-table">
                            <thead>
                                <tr>
                                    <th>Course Code</th>
                                    <th>Course Name</th>
                                    <th>Semester</th>
                                    <th>Grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${studentDetailsData.map(detail => `
                                    <tr>
                                        <td>${detail.course_code}</td>
                                        <td>${detail.course_name}</td>
                                        <td>${detail.semester}</td>
                                        <td>${detail.grade}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="sgpa-cgpa-graph">
                        <h3>SGPA/CGPA Progression</h3>
                        <canvas id="sgpaCgpaChart"></canvas>
                    </div>
                </div>
            `;

            // Create chart
            const ctx = document.getElementById('sgpaCgpaChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: semesters.map(sem => `Semester ${sem}`),
                    datasets: [
                        {
                            label: 'SGPA',
                            data: sgpaData,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.2,
                            borderWidth: 2,
                            pointBackgroundColor: '#3b82f6'
                        },
                        {
                            label: 'CGPA',
                            data: cgpaData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.2,
                            borderWidth: 2,
                            pointBackgroundColor: '#10b981'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: Math.max(0, Math.min(...sgpaData.filter(Boolean), ...cgpaData.filter(Boolean)) - 1),
                            max: Math.min(10, Math.max(...sgpaData.filter(Boolean), ...cgpaData.filter(Boolean)) + 1),
                            title: {
                                display: true,
                                text: 'Grade Points'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Semesters'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.raw !== null ? context.raw.toFixed(2) : 'N/A'}`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching student data:', error);
            studentForm.innerHTML = `<p style="color: red;">Error fetching data: ${error.message}</p>`;
            
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                alert('Session expired. Please login again.');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                window.location.href = 'login.html';
            }
        }
    });
});
