const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/users.model');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if ( !authHeader ) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided'
            });
        }

        if ( !authHeader.startsWith('Bearer ' ) ) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Invalid token format. Use "Bearer <token>"'
            });
        }

        const token = authHeader.substring(7);

        if ( !token ) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await findUserById(decoded.id);

        if ( !user ) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. User not found'
            });
        }

        if ( !user.is_active ) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Account is deactivated'
            });
        }

        req.user = user;
        req.token = token;

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Token has expired'
            });
        }

        console.error('Token verification error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication',
            error: error.message
        });
    }
};

const requireAuth = (req, res, next) => {
    if ( !req.user ) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please login first'
        });
    }

    next();
};

const requireRole = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            if ( !req.user ) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if ( !allowedRoles.includes(req.user.role) ) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
                });
            }

            next();
        } catch (error) {
            console.error('Role verification error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during authorization',
                error: error.message
            });
        }
    };
};

// Admin only access middleware
const requireAdmin = requireRole(['Admin']);

// Admin and Librarian access middleware
const requireAdminOrLibrarian = requireRole(['Admin', 'Librarian']);

// User/Member access middleware (all authenticated users)
const requireUser = requireRole(['Admin', 'Librarian', 'User']);

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if ( !authHeader || !authHeader.startsWith('Bearer ') ) {
            return next();
        }

        const token = authHeader.substring(7);

        if ( !token ) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await findUserById(decoded.id);
        
        if (user && user.is_active) {
            req.user = user;
            req.token = token;
        }

        next();
    } catch (error) {
        next();
    }
};

// Check if user owns the resource or has admin/librarian privileges
const requireOwnershipOrAdmin = (resourceUserIdParam = 'id') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const resourceUserId = parseInt(req.params[resourceUserIdParam]);
            const currentUserId = req.user.id;
            const userRole = req.user.role;

            // Allow access if user is admin, librarian, or owns the resource
            if (userRole === 'Admin' || userRole === 'Librarian' || currentUserId === resourceUserId) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your own resources'
            });

        } catch (error) {
            console.error('Ownership verification error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during ownership verification',
                error: error.message
            });
        }
    };
};

// Rate limiting based on user role
const roleBasedRateLimit = () => {
    const requestCounts = new Map();
    
    return (req, res, next) => {
        try {
            const userId = req.user ? req.user.id : req.ip;
            const userRole = req.user ? req.user.role : 'Guest';
            
            // Define rate limits per role (requests per minute)
            const rateLimits = {
                'Guest': 20,
                'User': 60,
                'Librarian': 120,
                'Admin': 300
            };
            
            const limit = rateLimits[userRole] || rateLimits['Guest'];
            const windowMs = 60 * 1000; // 1 minute
            
            const now = Date.now();
            const userRequests = requestCounts.get(userId) || { count: 0, resetTime: now + windowMs };
            
            if (now > userRequests.resetTime) {
                // Reset counter
                userRequests.count = 1;
                userRequests.resetTime = now + windowMs;
            } else {
                userRequests.count++;
            }
            
            requestCounts.set(userId, userRequests);
            
            if (userRequests.count > limit) {
                return res.status(429).json({
                    success: false,
                    message: `Rate limit exceeded. Maximum ${limit} requests per minute for ${userRole} role`,
                    resetTime: new Date(userRequests.resetTime).toISOString()
                });
            }
            
            // Add rate limit headers
            res.set({
                'X-RateLimit-Limit': limit,
                'X-RateLimit-Remaining': Math.max(0, limit - userRequests.count),
                'X-RateLimit-Reset': new Date(userRequests.resetTime).toISOString()
            });
            
            next();
            
        } catch (error) {
            console.error('Rate limiting error:', error.message);
            next(); // Continue on error to not block legitimate requests
        }
    };
};

// Middleware to log user actions (audit trail)
const auditLogger = (action) => {
    return (req, res, next) => {
        try {
            const user = req.user;
            const timestamp = new Date().toISOString();
            const ip = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent');
            
            const logData = {
                timestamp,
                action,
                user_id: user ? user.id : null,
                user_email: user ? user.email : null,
                user_role: user ? user.role : 'Guest',
                ip,
                userAgent,
                endpoint: `${req.method} ${req.originalUrl}`,
                params: req.params,
                query: req.query
            };
            
            // In production, you would send this to a proper logging service
            console.log('AUDIT LOG:', JSON.stringify(logData, null, 2));
            
            next();
            
        } catch (error) {
            console.error('Audit logging error:', error.message);
            next(); // Continue on error
        }
    };
};

module.exports = {
    verifyToken,
    requireAuth,
    requireRole,
    requireAdmin,
    requireAdminOrLibrarian,
    requireUser,
    optionalAuth,
    requireOwnershipOrAdmin,
    roleBasedRateLimit,
    auditLogger
};