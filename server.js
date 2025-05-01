const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const app = express();
const { generateToken, authenticateToken, checkDepartmentAccess } = require('./middleware');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'student_performance',
    password: process.env.PGPASSWORD || 'hruthwik2006', // Replace with your PostgreSQL password
    port: process.env.PGPORT || 5432,
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

// Authentication Routes
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Get user from database
        const userResult = await pool.query('SELECT * FROM Users WHERE username = $1', [username]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        
        const user = userResult.rows[0];
        
        // Check if password matches
        // In a real production environment, you should use bcrypt.compare()
        // For demo purposes, we're using direct comparison since we're not hashing passwords
        // const passwordMatches = await bcrypt.compare(password, user.password);
        const passwordMatches = (password === user.password);
        
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        
        // Generate JWT token
        const token = generateToken(user);
        
        res.json({
            message: 'Login successful',
            token,
            username: user.username,
            department: user.department
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Pass/Fail Stats
app.get('/pass_stats', authenticateToken, async (req, res) => {
    try {
        const gradePointsResult = await pool.query('SELECT * FROM Grade_Points');
        const gradePointsMap = new Map(gradePointsResult.rows.map(row => [row.grade, row.points]));

        // Filter by department if not admin
        let departmentFilter = '';
        let queryParams = [];
        
        if (req.user.department !== 'ALL') {
            departmentFilter = 'WHERE s.department = $1';
            queryParams.push(req.user.department);
        }

        const studentDetailsResult = await pool.query(`
            SELECT s.department, sd.grade
            FROM Student_Details sd
            JOIN Students s ON sd.roll_no = s.roll_no
            ${departmentFilter}
        `, queryParams);
        
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
app.get('/cgpa_stats', authenticateToken, async (req, res) => {
    try {
        // Filter by department if not admin
        let departmentFilter = '';
        let queryParams = [];
        
        if (req.user.department !== 'ALL') {
            departmentFilter = 'WHERE s.department = $1';
            queryParams.push(req.user.department);
        }

        const trackerResult = await pool.query(`
            SELECT DISTINCT s.roll_no, s.department, sg.semester
            FROM SGPA_CGPA_Tracker sg
            JOIN Students s ON sg.roll_no = s.roll_no
            ${departmentFilter}
        `, queryParams);
        
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
app.get('/students', authenticateToken, async (req, res) => {
    try {
        // Filter by department if not admin
        let query = 'SELECT * FROM Students';
        let queryParams = [];
        
        if (req.user.department !== 'ALL') {
            query = 'SELECT * FROM Students WHERE department = $1';
            queryParams.push(req.user.department);
        }

        const { rows } = await pool.query(query, queryParams);
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/students', authenticateToken, async (req, res) => {
    try {
        const { roll_no, name, department } = req.body;
        
        // Only admin or users in the same department can add students
        if (req.user.department !== 'ALL' && req.user.department !== department) {
            return res.status(403).json({ message: 'You are not authorized to add students to this department' });
        }
        
        await pool.query(
            'INSERT INTO Students (roll_no, name, department) VALUES ($1, $2, $3) ON CONFLICT (roll_no) DO NOTHING',
            [roll_no, name, department]
        );
        res.status(201).send('Student added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/students/:roll_no', authenticateToken, async (req, res) => {
    try {
        const { roll_no } = req.params;

        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can delete students
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to delete students from this department' });
        }

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
app.get('/courses', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Courses');
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/courses', authenticateToken, async (req, res) => {
    try {
        // Only admin can add courses
        if (req.user.department !== 'ALL') {
            return res.status(403).json({ message: 'Only administrators can add courses' });
        }
        
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

app.put('/courses/:course_code', authenticateToken, async (req, res) => {
    try {
        // Only admin can update courses
        if (req.user.department !== 'ALL') {
            return res.status(403).json({ message: 'Only administrators can update courses' });
        }
        
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

app.delete('/courses/:course_code', authenticateToken, async (req, res) => {
    try {
        // Only admin can delete courses
        if (req.user.department !== 'ALL') {
            return res.status(403).json({ message: 'Only administrators can delete courses' });
        }
        
        const { course_code } = req.params;
        await pool.query('DELETE FROM Courses WHERE course_code = $1', [course_code]);
        res.send('Course deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Marks Endpoints
app.get('/marks', authenticateToken, async (req, res) => {
    try {
        // Filter by department if not admin
        let query = 'SELECT m.* FROM Marks m';
        let queryParams = [];
        
        if (req.user.department !== 'ALL') {
            query = `
                SELECT m.* 
                FROM Marks m
                JOIN Students s ON m.roll_no = s.roll_no
                WHERE s.department = $1
            `;
            queryParams.push(req.user.department);
        }

        const { rows } = await pool.query(query, queryParams);
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/marks', authenticateToken, async (req, res) => {
    try {
        const { roll_no, course_code, minor_1, mid, minor_2, endsem } = req.body;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can add marks
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to add marks for students from this department' });
        }
        
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

app.put('/marks/:roll_no/:course_code', authenticateToken, async (req, res) => {
    try {
        const { roll_no, course_code } = req.params;
        const { minor_1, mid, minor_2, endsem } = req.body;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can update marks
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to update marks for students from this department' });
        }
        
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
app.get('/sgpa_cgpa', authenticateToken, async (req, res) => {
    try {
        // Filter by department if not admin
        let departmentFilter = '';
        let queryParams = [];
        
        if (req.user.department !== 'ALL') {
            departmentFilter = 'WHERE s.department = $1';
            queryParams.push(req.user.department);
        }
        
        const trackerResult = await pool.query(`
            SELECT sg.roll_no, s.name, s.department, sg.academic_year, sg.semester
            FROM SGPA_CGPA_Tracker sg
            JOIN Students s ON sg.roll_no = s.roll_no
            ${departmentFilter}
        `, queryParams);
        
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

app.post('/sgpa_cgpa', authenticateToken, async (req, res) => {
    try {
        const { roll_no, semester, academic_year } = req.body;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can add SGPA/CGPA records
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to add SGPA/CGPA records for students from this department' });
        }
        
        await pool.query(
            'INSERT INTO SGPA_CGPA_Tracker (roll_no, semester, academic_year) VALUES ($1, $2, $3) ON CONFLICT (roll_no, semester) DO UPDATE SET academic_year = $3',
            [roll_no, semester, academic_year]
        );
        res.status(201).send('Semester record added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/sgpa_cgpa/:roll_no/:semester', authenticateToken, async (req, res) => {
    try {
        const { roll_no, semester } = req.params;
        const { academic_year } = req.body;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can update SGPA/CGPA records
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to update SGPA/CGPA records for students from this department' });
        }
        
        await pool.query(
            'UPDATE SGPA_CGPA_Tracker SET academic_year = $1 WHERE roll_no = $2 AND semester = $3',
            [academic_year, roll_no, semester]
        );
        res.send('Semester record updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/sgpa_cgpa/:roll_no/:semester', authenticateToken, async (req, res) => {
    try {
        const { roll_no, semester } = req.params;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can delete SGPA/CGPA records
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to delete SGPA/CGPA records for students from this department' });
        }
        
        await pool.query('DELETE FROM SGPA_CGPA_Tracker WHERE roll_no = $1 AND semester = $2', [roll_no, semester]);
        res.send('Semester record deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Student_Details Endpoints
app.get('/students/:roll_no', authenticateToken, async (req, res) => {
    try {
        const { roll_no } = req.params;
        
        const studentResult = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentResult.rowCount === 0) {
            return res.status(404).send('Student not found');
        }
        
        const student = studentResult.rows[0];
        
        // Check department access
        if (req.user.department !== 'ALL' && req.user.department !== student.department) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You do not have access to students from this department'
            });
        }
        
        res.json(student);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get('/student_details', authenticateToken, async (req, res) => {
    try {
        // Filter by department if not admin
        let departmentFilter = '';
        let queryParams = [];
        
        if (req.user.department !== 'ALL') {
            departmentFilter = 'WHERE s.department = $1';
            queryParams.push(req.user.department);
        }
        
        const detailsResult = await pool.query(`
            SELECT sd.roll_no, s.name, s.department, sd.course_code, c.course_name, 
                   c.credits, sd.grade, sd.academic_year, sd.semester
            FROM Student_Details sd
            JOIN Students s ON sd.roll_no = s.roll_no
            JOIN Courses c ON sd.course_code = c.course_code
            ${departmentFilter}
        `, queryParams);
        
        res.json(detailsResult.rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/student_details', authenticateToken, async (req, res) => {
    try {
        const { roll_no, course_code, grade, academic_year, semester } = req.body;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can add student details
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to add details for students from this department' });
        }
        
        const courseCheck = await pool.query('SELECT * FROM Courses WHERE course_code = $1', [course_code]);
        if (courseCheck.rowCount === 0) {
            return res.status(400).send(`Course code ${course_code} does not exist. Please add it to the Courses table first.`);
        }
        
        await pool.query(
            'INSERT INTO Student_Details (roll_no, course_code, grade, academic_year, semester) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (roll_no, course_code) DO UPDATE SET grade = $3, academic_year = $4, semester = $5',
            [roll_no, course_code, grade, academic_year, semester]
        );
        res.status(201).send('Student details added');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.put('/student_details/:roll_no/:course_code', authenticateToken, async (req, res) => {
    try {
        const { roll_no, course_code } = req.params;
        const { grade, academic_year, semester } = req.body;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can update student details
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to update details for students from this department' });
        }
        
        await pool.query(
            'UPDATE Student_Details SET grade = $1, academic_year = $2, semester = $3 WHERE roll_no = $4 AND course_code = $5',
            [grade, academic_year, semester, roll_no, course_code]
        );
        res.send('Student details updated');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.delete('/student_details/:roll_no/:course_code', authenticateToken, async (req, res) => {
    try {
        const { roll_no, course_code } = req.params;
        
        // Check if student exists and get their department
        const studentCheck = await pool.query('SELECT * FROM Students WHERE roll_no = $1', [roll_no]);
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        
        const studentDepartment = studentCheck.rows[0].department;
        
        // Only admin or users in the same department can delete student details
        if (req.user.department !== 'ALL' && req.user.department !== studentDepartment) {
            return res.status(403).json({ message: 'You are not authorized to delete details for students from this department' });
        }
        
        await pool.query(
            'DELETE FROM Student_Details WHERE roll_no = $1 AND course_code = $2',
            [roll_no, course_code]
        );
        res.send('Student details deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Grade Points Endpoints
app.get('/grade_points', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM Grade_Points');
        res.json(rows);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/grade_points', authenticateToken, async (req, res) => {
    try {
        // Only admin can add grade points
        if (req.user.department !== 'ALL') {
            return res.status(403).json({ message: 'Only administrators can add grade points' });
        }
        
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

app.put('/grade_points/:grade', authenticateToken, async (req, res) => {
    try {
        // Only admin can update grade points
        if (req.user.department !== 'ALL') {
            return res.status(403).json({ message: 'Only administrators can update grade points' });
        }
        
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

app.delete('/grade_points/:grade', authenticateToken, async (req, res) => {
    try {
        // Only admin can delete grade points
        if (req.user.department !== 'ALL') {
            return res.status(403).json({ message: 'Only administrators can delete grade points' });
        }
        
        const { grade } = req.params;
        await pool.query('DELETE FROM Grade_Points WHERE grade = $1', [grade]);
        res.send('Grade points deleted');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Table Creation
async function ensureTablesExist() {
    try {
        // Create Students table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Students (
                roll_no TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT NOT NULL
            )
        `);

        // Create Courses table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Courses (
                course_code TEXT PRIMARY KEY,
                course_name TEXT UNIQUE NOT NULL,
                credits INTEGER NOT NULL
            )
        `);

        // Create Grade_Points table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Grade_Points (
                grade TEXT PRIMARY KEY,
                points REAL NOT NULL
            )
        `);

        // Create Student_Details table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Student_Details (
                roll_no TEXT,
                course_code TEXT,
                grade TEXT,
                academic_year TEXT,
                semester INTEGER,
                PRIMARY KEY (roll_no, course_code),
                FOREIGN KEY (roll_no) REFERENCES Students(roll_no) ON DELETE CASCADE,
                FOREIGN KEY (course_code) REFERENCES Courses(course_code) ON DELETE CASCADE,
                FOREIGN KEY (grade) REFERENCES Grade_Points(grade)
            )
        `);

        // Create Marks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Marks (
                roll_no TEXT,
                course_code TEXT,
                minor_1 REAL,
                mid REAL,
                minor_2 REAL,
                endsem REAL,
                PRIMARY KEY (roll_no, course_code),
                FOREIGN KEY (roll_no) REFERENCES Students(roll_no) ON DELETE CASCADE,
                FOREIGN KEY (course_code) REFERENCES Courses(course_code) ON DELETE CASCADE
            )
        `);

        // Create SGPA_CGPA_Tracker table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS SGPA_CGPA_Tracker (
                roll_no TEXT,
                semester INTEGER,
                academic_year TEXT NOT NULL,
                PRIMARY KEY (roll_no, semester),
                FOREIGN KEY (roll_no) REFERENCES Students(roll_no) ON DELETE CASCADE
            )
        `);

        // Check if Grade_Points table is empty and initialize if necessary
        const gradePointsCount = await pool.query('SELECT COUNT(*) FROM Grade_Points');
        if (gradePointsCount.rows[0].count === '0') {
            const defaultGradePoints = [
                { grade: 'EX', points: 10 },
                { grade: 'A', points: 9 },
                { grade: 'B', points: 8 },
                { grade: 'C', points: 7 },
                { grade: 'D', points: 6 },
                { grade: 'E', points: 5 },
                { grade: 'P', points: 4 },
                { grade: 'F', points: 0 },
                { grade: 'R', points: 0 }
            ];
            for (const gp of defaultGradePoints) {
                await pool.query(
                    'INSERT INTO Grade_Points (grade, points) VALUES ($1, $2) ON CONFLICT (grade) DO NOTHING',
                    [gp.grade, gp.points]
                );
            }
            console.log('Grade points initialized');
        }

        // Create Users table for authentication
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                department TEXT NOT NULL
            )
        `);

        // Insert sample users if they don't exist
        const usersExist = await pool.query('SELECT COUNT(*) FROM Users');
        if (usersExist.rows[0].count === '0') {
            const sampleUsers = [
                { username: 'admin', password: 'admin123', department: 'ALL' },  // Admin can access all departments
                { username: 'cs_user', password: 'cs123', department: 'CSE' },   // CS department user
                { username: 'ece_user', password: 'ece123', department: 'ECE' },  // ECE department user
                { username: 'mech_user', password: 'mech123', department: 'MECH' } // MECH department user
            ];
            
            for (const user of sampleUsers) {
                // In a real app, you'd hash the password with bcrypt
                // const hashedPassword = await bcrypt.hash(user.password, 10);
                await pool.query(
                    'INSERT INTO Users (username, password, department) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
                    [user.username, user.password, user.department]
                );
            }
            console.log('Sample users created');
        }

        console.log('All tables created or verified');
        await initializeCourses();
    } catch (error) {
        console.error('Error creating tables:', error.message);
    }
}

// Ensure tables exist before starting server
ensureTablesExist().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
});
