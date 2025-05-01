const jwt = require('jsonwebtoken');

// JWT secret key
const JWT_SECRET = 'spms-secret-key'; // In production, this should be in environment variables

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id,
            username: user.username,
            department: user.department 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = verifyToken(token);
    if (!user) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
}

// Department access middleware
function checkDepartmentAccess(req, res, next) {
    // Skip check if no user (should be caught by authenticateToken middleware)
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Admin department 'ALL' has access to everything
    if (req.user.department === 'ALL') {
        return next();
    }
    
    // Check if the requested roll_no's department matches the user's department
    if (req.params.roll_no) {
        const rollNo = req.params.roll_no;
        
        // This is just a placeholder - the actual implementation would query the database
        // to check the department of the student with the given roll_no
        // For now, we'll just pass it through and do the check in the routes
        req.userDepartment = req.user.department;
    }
    
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken,
    checkDepartmentAccess,
    JWT_SECRET
};
