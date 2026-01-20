const authenticateToken = require('@middleware/auth');
const jwt = require('jsonwebtoken');

describe('Auth Middleware', () => {
    let req, res, next;
    let oldEnv;

    beforeEach(() => {
        oldEnv = process.env;
        process.env = { ...oldEnv };
        req = { cookies: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    afterEach(() => {
        process.env = oldEnv;
        jest.clearAllMocks();
    });

    test('should return 500 if no secret configured', () => {
        delete process.env.JWT_SECRET;
        delete process.env.ADMIN_PASSWORD;
        req.cookies.auth_token = 'some-token';

        // Suppress console.error for this test
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
        
        consoleSpy.mockRestore();
    });
    
    test('should call next if valid token', () => {
        process.env.JWT_SECRET = 'secret';
        const token = jwt.sign({ name: 'user' }, 'secret');
        req.cookies.auth_token = token;
        
        authenticateToken(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
    });

    test('should return 401 if no token', () => {
        authenticateToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should return 403 if invalid token', () => {
        process.env.JWT_SECRET = 'secret';
        req.cookies.auth_token = 'invalid-token';
        
        authenticateToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
