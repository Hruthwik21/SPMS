const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'student_performance',
    password: 'hruthwik2006', // Replace with your PostgreSQL password
    port: 5432,
});

// Initialize predefined courses
async function initializeCourses() {
    const predefinedCourses = [
        { course_code: 'CS101', course_name: 'Data Structures', credits: 3 },
        { course_code: 'CS102', course_name: 'Algorithms', credits: 4 },
        { course_code: 'MA101', course_name: 'Calculus', credits: 3 },
        { course_code: 'PH101', course_name: 'Physics', credits: 4 }
    ];

    try {
        for (const course of predefinedCourses) {
            await pool.query(
                'INSERT INTO Courses (course_code, course_name, credits) VALUES ($1, $2, $3) ON CONFLICT (course_name) DO NOTHING',
                [course.course_code, course.course_name, course.credits]
            );
            console.log(`Processed course: ${course.course_name}`);
        }
        console.log('Predefined courses initialized');
    } catch (error) {
        console.error('Error initializing courses:', error.message);
    }
}

// Helper function to calculate SGPA and CGPA
async function calculateGpa(roll_no, semester) {
    const gradePointsResult = await pool.query('SELECT * FROM Grade_Points');
    const gradePointsMap = new Map(gradePointsResult.rows.map(row => [row.grade, row.points]));

    const semesterDetailsResult = await pool.query(
        `SELECT c.credits, sd.grade 
         FROM Student_Details sd 
         JOIN Courses c ON sd.course_code = c.course_code 
         WHERE sd.roll_no = $1 AND sd.semester = $2`,
        [roll_no, semester]
    );
    const semesterCourses = semesterDetailsResult.rows;

    let totalCredits = 0;
    let totalPoints = 0;
    for (const course of semesterCourses) {
        if (course.credits && course.grade && gradePointsMap.has(course.grade)) {
            const points = gradePointsMap.get(course.grade);
            totalCredits += parseFloat(course.credits);
            totalPoints += parseFloat(course.credits) * points;
        }
    }
    const sgpa = totalCredits > 0 ? totalPoints / totalCredits : null;

    const allSemestersResult = await pool.query(
        `SELECT c.credits, sd.grade 
         FROM Student_Details sd 
         JOIN Courses c ON sd.course_code = c.course_code 
         WHERE sd.roll_no = $1 AND sd.semester <= $2`,
        [roll_no, semester]
    );
    const allCourses = allSemestersResult.rows;

    let cumulativeCredits = 0;
    let cumulativePoints = 0;
    for (const course of allCourses) {
        if (course.credits && course.grade && gradePointsMap.has(course.grade)) {
            const points = gradePointsMap.get(course.grade);
            cumulativeCredits += parseFloat(course.credits);
            cumulativePoints += parseFloat(course.credits) * points;
        }
    }
    const cgpa = cumulativeCredits > 0 ? cumulativePoints / cumulativeCredits : null;

    return { sgpa, cgpa };
}

// Pass/Fail Stats
app.get('/pass_stats', async (req, res) => {
    try {
        const gradePointsResult = await pool.query('SELECT * FROM Grade_Points');
        const gradePointsMap = new Map(gradePointsResult.rows.map(row => [row.grade, row.points]));

        const studentDetailsResult = await pool.query(`
            SELECT s.department, sd.grade
            FROM Student_Details sd
            JOIN Students s ON sd.roll_no = s.roll_no
        `);
        const courses = studentDetailsResult.rows;

        const statsByDept = {};
        courses.forEach(course => {
            const dept = course.department;
            if (!statsByDept[dept]) {
                statsByDept[dept] = { pass: 0, fail: 0, total: 0 };
            }
            const points = gradePointsMap.get(course.grade) || 0;
            statsByDept[dept].total += 1;
            if (points === 0) {
                statsByDept[dept].fail += 1;
            } else {
                statsByDept[dept].pass += 1;
            }
        });

        const result = Object.keys(statsByDept).map(dept => ({
            department: dept,
            pass: statsByDept[dept].pass,
            fail: statsByDept[dept].fail,
            total: statsByDept[dept].total,
            passPercentage: statsByDept[dept].total > 0 ? (statsByDept[dept].pass / statsByDept[dept].total) * 100 : 0
        }));

        res.json(result);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// CGPA Stats
app.get('/cgpa_stats', async (req, res) => {
    try {
        const trackerResult = await pool.query(`
            SELECT DISTINCT s.roll_no, s.department, sg.semester
            FROM SGPA_CGPA_Tracker sg
            JOIN Students s ON sg.roll_no = s.roll_no
        `);
        const studentSemesters = trackerResult.rows;

        const cgpaByDept = {};
        for (const { roll_no, department, semester } of studentSemesters) {
            const { cgpa } = await calculateGpa(roll_no, semester);
            if (cgpa !== null) {
                if (!cgpaByDept[department]) {
                    cgpaByDept[department] = [];
                }
                cgpaByDept[department].push(cgpa);
            }
        }

        const result = Object.keys(cgpaByDept).map(dept => {
            const cgpas = cgpaByDept[dept];
            const avg = cgpas.reduce((sum, val) => sum + val, 0) / cgpas.length;
            const min = Math.min(...cgpas);
            const max = Math.max(...cgpas);
            return { department: dept, avg, min, max };
        });

        res.json(result);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Students Endpoints
app.get('/students', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Students');
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/students', async (req, res) => {
    try {
        const { roll_no, name, department } = req.body;
        await pool.query(
            'INSERT INTO Students (roll_no, name, department) VALUES ($1, $2, $3) ON CONFLICT (roll_no) DO NOTHING',
            [roll_no, name, department]
        );
        res.status(201).send('Student added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/students/:roll_no', async (req, res) => {
    try {
        const { roll_no } = req.params;

        // Start a transaction to ensure atomicity
        await pool.query('BEGIN');

        // Delete from Students; related records in Student_Details, Marks, and SGPA_CGPA_Tracker
        // will be deleted automatically due to ON DELETE CASCADE
        const result = await pool.query(
            'DELETE FROM Students WHERE roll_no = $1',
            [roll_no]
        );

        if (result.rowCount === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Student not found.' });
        }

        await pool.query('COMMIT');
        res.status(200).json({ message: 'Student and all related data deleted successfully.' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error deleting student:', error.message);
        res.status(500).json({ error: 'Failed to delete student.' });
    }
});

// Courses Endpoints
app.get('/courses', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Courses');
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/courses', async (req, res) => {
    try {
        const { course_code, course_name, credits } = req.body;
        await pool.query(
            'INSERT INTO Courses (course_code, course_name, credits) VALUES ($1, $2, $3) ON CONFLICT (course_code) DO UPDATE SET course_name = $2, credits = $3',
            [course_code, course_name, credits]
        );
        res.status(201).send('Course added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/courses/:course_code', async (req, res) => {
    try {
        const { course_code } = req.params;
        const { course_name, credits } = req.body;
        await pool.query(
            'UPDATE Courses SET course_name = $1, credits = $2 WHERE course_code = $3',
            [course_name, credits, course_code]
        );
        res.send('Course updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/courses/:course_code', async (req, res) => {
    try {
        const { course_code } = req.params;
        await pool.query('DELETE FROM Courses WHERE course_code = $1', [course_code]);
        res.send('Course deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Marks Endpoints
app.get('/marks', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Marks');
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/marks', async (req, res) => {
    try {
        const { roll_no, course_code, minor_1, mid, minor_2, endsem } = req.body;
        const courseCheck = await pool.query('SELECT * FROM Courses WHERE course_code = $1', [course_code]);
        if (courseCheck.rowCount === 0) {
            return res.status(400).send(`Course code ${course_code} does not exist. Please add it to the Courses table first.`);
        }
        await pool.query(
            'INSERT INTO Marks (roll_no, course_code, minor_1, mid, minor_2, endsem) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (roll_no, course_code) DO UPDATE SET minor_1 = $3, mid = $4, minor_2 = $5, endsem = $6',
            [roll_no, course_code, minor_1, mid, minor_2, endsem]
        );
        res.status(201).send('Marks added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/marks/:roll_no/:course_code', async (req, res) => {
    try {
        const { roll_no, course_code } = req.params;
        const { minor_1, mid, minor_2, endsem } = req.body;
        await pool.query(
            'UPDATE Marks SET minor_1 = $1, mid = $2, minor_2 = $3, endsem = $4 WHERE roll_no = $5 AND course_code = $6',
            [minor_1, mid, minor_2, endsem, roll_no, course_code]
        );
        res.send('Marks updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// SGPA_CGPA_Tracker Endpoints
app.get('/sgpa_cgpa', async (req, res) => {
    try {
        const trackerResult = await pool.query(`
            SELECT sg.roll_no, s.name, s.department, sg.academic_year, sg.semester
            FROM SGPA_CGPA_Tracker sg
            JOIN Students s ON sg.roll_no = s.roll_no
        `);
        const rows = trackerResult.rows;

        const result = [];
        for (const row of rows) {
            const { sgpa, cgpa } = await calculateGpa(row.roll_no, row.semester);
            result.push({
                roll_no: row.roll_no,
                name: row.name,
                department: row.department,
                academic_year: row.academic_year,
                semester: row.semester,
                sgpa: sgpa,
                cgpa: cgpa
            });
        }
        res.json(result);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/sgpa_cgpa', async (req, res) => {
    try {
        const { roll_no, semester, academic_year } = req.body;
        await pool.query(
            'INSERT INTO SGPA_CGPA_Tracker (roll_no, semester, academic_year) VALUES ($1, $2, $3) ON CONFLICT (roll_no, semester) DO UPDATE SET academic_year = $3',
            [roll_no, semester, academic_year]
        );
        res.status(201).send('Semester record added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/sgpa_cgpa/:roll_no/:semester', async (req, res) => {
    try {
        const { roll_no, semester } = req.params;
        const { academic_year } = req.body;
        await pool.query(
            'UPDATE SGPA_CGPA_Tracker SET academic_year = $1 WHERE roll_no = $2 AND semester = $3',
            [academic_year, roll_no, semester]
        );
        res.send('Semester record updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/sgpa_cgpa/:roll_no/:semester', async (req, res) => {
    try {
        const { roll_no, semester } = req.params;

        // Start a transaction to ensure atomicity
        await pool.query('BEGIN');

        // Delete from Student_Details for this roll_no and semester
        // Marks will cascade automatically due to ON DELETE CASCADE
        await pool.query(
            'DELETE FROM Student_Details WHERE roll_no = $1 AND semester = $2',
            [roll_no, semester]
        );

        // Delete from SGPA_CGPA_Tracker
        await pool.query(
            'DELETE FROM SGPA_CGPA_Tracker WHERE roll_no = $1 AND semester = $2',
            [roll_no, semester]
        );

        await pool.query('COMMIT');
        res.send('Semester record and related data deleted');
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).send(error.message);
    }
});

// Student_Details Endpoints
app.get('/student_details', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT sd.roll_no, s.name, s.department, sd.academic_year, sd.semester, c.course_name, sd.course_code, c.credits, sd.grade
            FROM Student_Details sd
            JOIN Students s ON sd.roll_no = s.roll_no
            JOIN Courses c ON sd.course_code = c.course_code
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/student_details', async (req, res) => {
    try {
        const { roll_no, course_code, academic_year, semester, grade } = req.body;
        const courseCheck = await pool.query('SELECT * FROM Courses WHERE course_code = $1', [course_code]);
        if (courseCheck.rowCount === 0) {
            return res.status(400).send(`Course code ${course_code} does not exist. Please add it to the Courses table first.`);
        }
        await pool.query(
            'INSERT INTO Student_Details (roll_no, course_code, academic_year, semester, grade) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (roll_no, course_code) DO UPDATE SET academic_year = $3, semester = $4, grade = $5',
            [roll_no, course_code, academic_year, semester, grade]
        );
        res.status(201).send('Student details added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/student_details/:roll_no/:course_code', async (req, res) => {
    try {
        const { roll_no, course_code } = req.params;
        const { academic_year, semester, grade } = req.body;
        await pool.query(
            'UPDATE Student_Details SET academic_year = $1, semester = $2, grade = $3 WHERE roll_no = $4 AND course_code = $5',
            [academic_year, semester, grade, roll_no, course_code]
        );
        res.send('Student details updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/student_details/:roll_no/:course_code', async (req, res) => {
    try {
        const { roll_no, course_code } = req.params;

        // Delete from Student_Details; Marks will cascade automatically
        await pool.query(
            'DELETE FROM Student_Details WHERE roll_no = $1 AND course_code = $2',
            [roll_no, course_code]
        );

        res.send('Student details and related marks deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Grade_Points Endpoints
app.get('/grade_points', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Grade_Points');
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/grade_points', async (req, res) => {
    try {
        const { grade, points } = req.body;
        await pool.query(
            'INSERT INTO Grade_Points (grade, points) VALUES ($1, $2) ON CONFLICT (grade) DO UPDATE SET points = $2',
            [grade, points]
        );
        res.status(201).send('Grade points added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/grade_points/:grade', async (req, res) => {
    try {
        const { grade } = req.params;
        const { points } = req.body;
        await pool.query(
            'UPDATE Grade_Points SET points = $1 WHERE grade = $2',
            [points, grade]
        );
        res.send('Grade points updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/grade_points/:grade', async (req, res) => {
    try {
        const { grade } = req.params;
        await pool.query('DELETE FROM Grade_Points WHERE grade = $1', [grade]);
        res.send('Grade points deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});
app.get('/students/:roll_no', async (req, res) => {
    try {
        const { roll_no } = req.params;
        console.log(`Fetching student with roll_no: ${roll_no}`);

        const studentResult = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentResult.rowCount === 0) {
            console.log(`Student with roll_no ${roll_no} not found`);
            return res.status(404).json({ error: 'Student not found' });
        }
        const student = studentResult.rows[0];
        console.log('Student found:', student);

        const detailsResult = await pool.query(`
            SELECT sd.*, c.course_name, c.credits
            FROM Student_Details sd
            JOIN Courses c ON sd.course_code = c.course_code
            WHERE sd.roll_no = $1
        `, [roll_no]);
        console.log('Student details:', detailsResult.rows);

        const marksResult = await pool.query('SELECT * FROM Marks WHERE roll_no = $1', [roll_no]);
        console.log('Marks:', marksResult.rows);

        const sgpaCgpaResult = await pool.query('SELECT * FROM SGPA_CGPA_Tracker WHERE roll_no = $1 ORDER BY semester DESC LIMIT 1', [roll_no]);
        console.log('SGPA/CGPA Tracker:', sgpaCgpaResult.rows);

        const { sgpa, cgpa } = sgpaCgpaResult.rows[0] ? await calculateGpa(roll_no, sgpaCgpaResult.rows[0].semester) : { sgpa: null, cgpa: null };
        console.log(`Calculated SGPA: ${sgpa}, CGPA: ${cgpa}`);

        const response = {
            rollNo: student.roll_no,
            name: student.name,
            department: student.department,
            academicYear: detailsResult.rows[0]?.academic_year || 'N/A',
            semester: detailsResult.rows[0]?.semester || 'N/A',
            sgpa: sgpa?.toFixed(2) || 'N/A',
            cgpa: cgpa?.toFixed(2) || 'N/A',
            courses: detailsResult.rows.map(row => ({
                courseName: row.course_name,
                courseCode: row.course_code,
                grade: row.grade
            })),
            marks: marksResult.rows.map(row => ({
                courseCode: row.course_code,
                minor1: row.minor_1,
                mid: row.mid,
                minor2: row.minor_2,
                endSem: row.endsem
            }))
        };
        console.log('Sending response:', response);
        res.json(response);
    } catch (error) {
        console.error('Error fetching student:', error.message);
        res.status(500).json({ error: 'Failed to fetch student data' });
    }
});
// Start the server
initializeCourses().then(() => {
    app.listen(3000, () => console.log('Server running on port 3000'));
});
