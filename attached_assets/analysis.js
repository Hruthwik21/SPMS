document.addEventListener('DOMContentLoaded', async () => {
    const rollNoSearch = document.getElementById('rollNoSearch');
    const searchStudentButton = document.getElementById('searchStudent');
    const studentDetails = document.getElementById('studentDetails');
    const studentForm = document.getElementById('studentForm');
    const departmentSelect = document.getElementById('departmentSelect');
    const courseCodeSelect = document.getElementById('courseCodeSelect');
    const departmentCgpaChange = document.getElementById('departmentCgpaChange');
    const courseCgpaChange = document.getElementById('courseCgpaChange');

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

    // Populate department and course code dropdowns
    try {
        // Fetch all students to get departments
        const studentsResponse = await fetch('http://localhost:3000/students');
        if (!studentsResponse.ok) throw new Error('Error fetching students');
        const students = await studentsResponse.json();
        const departments = [...new Set(students.map(student => student.department).filter(Boolean))].sort();
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });

        // Fetch all student details to get course codes
        const detailsResponse = await fetch('http://localhost:3000/student_details');
        if (!detailsResponse.ok) throw new Error('Error fetching student details');
        const details = await detailsResponse.json();
        const courseCodes = [...new Set(details.map(detail => detail.course_code).filter(Boolean))].sort();
        courseCodes.forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            courseCodeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating dropdowns:', error);
        departmentCgpaChange.innerHTML = `<p style="color: red;">Error loading departments: ${error.message}</p>`;
        courseCgpaChange.innerHTML = `<p style="color: red;">Error loading course codes: ${error.message}</p>`;
    }

    // Department selection handler
    departmentSelect.addEventListener('change', async () => {
        const selectedDept = departmentSelect.value;
        if (!selectedDept) {
            departmentCgpaChange.innerHTML = '';
            return;
        }

        try {
            // Fetch all students in the selected department
            const studentsResponse = await fetch('http://localhost:3000/students');
            const students = await studentsResponse.json();
            const deptStudents = students.filter(student => student.department === selectedDept).map(student => student.rollNo);

            if (deptStudents.length === 0) {
                departmentCgpaChange.innerHTML = '<p>No students found in this department.</p>';
                return;
            }

            // Fetch student details and SGPA/CGPA
            const detailsResponse = await fetch('http://localhost:3000/student_details');
            const allDetails = await detailsResponse.json();
            const sgpaCgpaResponse = await fetch('http://localhost:3000/sgpa_cgpa');
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
        }
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
            const detailsResponse = await fetch('http://localhost:3000/student_details');
            const allDetails = await detailsResponse.json();

            // Get academic years
            const years = [...new Set(allDetails.map(row => row.academic_year))].sort();
            if (years.length < 2) {
                courseCgpaChange.innerHTML = '<p>Insufficient academic years for grade comparison.</p>';
                return;
            }

            const latestYear = years[years.length - 1];
            const previousYear = years[years.length - 2];

            // Calculate average grade points for latest and previous years
            const latestCourseDetails = allDetails.filter(detail => detail.course_code === selectedCourse && detail.academic_year === latestYear);
            const previousCourseDetails = allDetails.filter(detail => detail.course_code === selectedCourse && detail.academic_year === previousYear);

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
        }
    });

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
            const studentResponse = await fetch(`http://localhost:3000/students/${rollNo}`);
            if (!studentResponse.ok) {
                if (studentResponse.status === 404) {
                    studentDetails.style.display = 'block';
                    studentForm.innerHTML = '<p style="color: red;">Roll No is not found.</p>';
                    console.log(`Roll No ${rollNo} not found (404)`);
                    return;
                }
                throw new Error(`Error fetching student data (Status: ${studentResponse.status})`);
            }
            const student = await studentResponse.json();

            const detailsResponse = await fetch(`http://localhost:3000/student_details`);
            const allDetails = await detailsResponse.json();
            const studentDetailsData = allDetails.filter(row => row.roll_no === rollNo).sort((a, b) => a.semester - b.semester);

            const marksResponse = await fetch(`http://localhost:3000/marks`);
            const allMarks = await marksResponse.json();
            const studentMarks = allMarks.filter(row => row.roll_no === rollNo);

            const sgpaCgpaResponse = await fetch(`http://localhost:3000/sgpa_cgpa`);
            const allSgpaCgpa = await sgpaCgpaResponse.json();
            const studentSgpaCgpa = allSgpaCgpa.filter(row => row.roll_no === rollNo).sort((a, b) => a.semester - b.semester);

            // Group data by academic year
            const years = [...new Set(studentDetailsData.map(row => row.academic_year))].sort();
            let htmlContent = `
                <div class="student-info-graph">
                    <div class="student-info">
                        <h3>Student Details</h3>
                        <div class="form-group">
                            <label>Roll No:</label>
                            <input type="text" value="${student.rollNo || 'N/A'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Name:</label>
                            <input type="text" value="${student.name || 'N/A'}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Department:</label>
                            <input type="text" value="${student.department || 'N/A'}" readonly>
                        </div>
                    </div>
                    <div class="sgpa-cgpa-graph">
                        <canvas id="sgpaCgpaChart"></canvas>
                    </div>
                </div>
            `;

            // Calculate CGPA change between latest and previous academic year
            let cgpaChangeHtml = '';
            if (years.length >= 2) {
                const latestYear = years[years.length - 1];
                const previousYear = years[years.length - 2];

                // Find the highest semester in each year
                const latestYearDetails = studentDetailsData.filter(row => row.academic_year === latestYear);
                const previousYearDetails = studentDetailsData.filter(row => row.academic_year === previousYear);
                const latestSemester = Math.max(...latestYearDetails.map(row => row.semester));
                const previousSemester = Math.max(...previousYearDetails.map(row => row.semester));

                // Get CGPA for the highest semester of each year
                const latestCgpa = studentSgpaCgpa.find(row => row.semester === latestSemester)?.cgpa || null;
                const previousCgpa = studentSgpaCgpa.find(row => row.semester === previousSemester)?.cgpa || null;

                if (latestCgpa !== null && previousCgpa !== null) {
                    const cgpaDiff = (latestCgpa - previousCgpa).toFixed(2);
                    const cgpaPercentChange = (((latestCgpa - previousCgpa) / previousCgpa) * 100).toFixed(2);
                    const changeText = cgpaDiff >= 0 ? 'Rise' : 'Fall';
                    const percentChangeText = cgpaPercentChange >= 0 ? `+${cgpaPercentChange}%` : `${cgpaPercentChange}%`;
                    cgpaChangeHtml = `
                        <div class="cgpa-change-box">
                            <h4>CGPA Change (Latest vs Previous Academic Year)</h4>
                            <p>${changeText}: ${cgpaDiff >= 0 ? '+' : ''}${cgpaDiff} points</p>
                            <p>Percentage Change: ${percentChangeText}</p>
                            <p>Latest Year (${latestYear}): ${latestCgpa.toFixed(2)}</p>
                            <p>Previous Year (${previousYear}): ${previousCgpa.toFixed(2)}</p>
                        </div>
                    `;
                } else {
                    cgpaChangeHtml = `
                        <div class="cgpa-change-box">
                            <p style="color: red;">CGPA data unavailable for comparison.</p>
                        </div>
                    `;
                }
            } else {
                cgpaChangeHtml = `
                    <div class="cgpa-change-box">
                        <p>Insufficient academic years for CGPA comparison.</p>
                    </div>
                `;
            }

            // Insert CGPA change box before student details
            studentForm.innerHTML = cgpaChangeHtml + htmlContent;

            years.forEach(year => {
                const yearDetails = studentDetailsData.filter(row => row.academic_year === year);
                const semesters = [...new Set(yearDetails.map(row => row.semester))].sort((a, b) => a - b);

                htmlContent += `<h4>Academic Year: ${year}</h4><div class="semester-container">`;
                semesters.forEach(semester => {
                    const semesterDetails = yearDetails.filter(row => row.semester === semester);
                    const semesterSgpaCgpa = studentSgpaCgpa.find(row => row.semester === semester) || {};
                    const semesterMarks = studentMarks.filter(mark => semesterDetails.some(detail => detail.course_code === mark.course_code));

                    htmlContent += `
                        <div class="semester-box">
                            <h5>Semester ${semester}</h5>
                            <div class="form-group">
                                <label>SGPA:</label>
                                <input type="text" value="${semesterSgpaCgpa.sgpa !== null ? semesterSgpaCgpa.sgpa.toFixed(2) : 'N/A'}" readonly>
                            </div>
                            <div class="form-group">
                                <label>CGPA:</label>
                                <input type="text" value="${semesterSgpaCgpa.cgpa !== null ? semesterSgpaCgpa.cgpa.toFixed(2) : 'N/A'}" readonly>
                            </div>
                            <div class="form-group">
                                <label>Courses:</label>
                                <textarea readonly>${
                                    semesterDetails.length > 0
                                        ? semesterDetails.map(row => `${row.course_name} (${row.course_code}) - Grade: ${row.grade || 'N/A'}`).join('\n')
                                        : 'No courses available.'
                                }</textarea>
                            </div>
                            <div class="form-group">
                                <label>Marks:</label>
                                <textarea readonly>${
                                    semesterMarks.length > 0
                                        ? semesterMarks.map(mark => `${mark.course_code}: Minor-1: ${mark.minor_1 || 'N/A'}, Mid: ${mark.mid || 'N/A'}, Minor-2: ${mark.minor_2 || 'N/A'}, End Sem: ${mark.endsem || 'N/A'}`).join('\n')
                                        : 'No marks available.'
                                }</textarea>
                            </div>
                        </div>
                    `;
                });
                htmlContent += `</div>`;
            });

            studentForm.innerHTML = cgpaChangeHtml + htmlContent;

            // Create SGPA and CGPA graph
            const semestersData = studentSgpaCgpa.map(row => `Sem ${row.semester}`);
            const sgpaData = studentSgpaCgpa.map(row => row.sgpa || 0);
            const cgpaData = studentSgpaCgpa.map(row => row.cgpa || 0);

            const ctx = document.getElementById('sgpaCgpaChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: semestersData,
                    datasets: [
                        {
                            label: 'SGPA',
                            data: sgpaData,
                            borderColor: 'rgba(46, 204, 113, 1)',
                            backgroundColor: 'rgba(46, 204, 113, 0.2)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'CGPA',
                            data: cgpaData,
                            borderColor: 'rgba(52, 152, 219, 1)',
                            backgroundColor: 'rgba(52, 152, 219, 0.2)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 10,
                            title: {
                                display: true,
                                text: 'GPA'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Semesters'
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching student:', error);
            studentDetails.style.display = 'block';
            studentForm.innerHTML = `<p style="color: red;">Error: ${error.message}. Please try again later.</p>`;
        }
    });
});
