import jwt from "jsonwebtoken";
const jwt_password = process.env.JWT_SECRET || "secret123"
export const Usermiddleware = async (req, res, next) => {
    const header = req.headers.authorization;
    // check if the authorization header is present
    if (!header) {
        return res.status(401).send('Authorization header missing');
    }
    // extract the token from the header
    const token = header.split(' ')[1];
    // check if the token is present or not 
    if (!token) {
        return res.status(401).send('Token missing');
    }
    try {
        console.log("Authorization header:", header);
        console.log("Extracted token:", token);
        // verify the token using the jwt_password secret
        const decoded = jwt.verify(token, jwt_password);
        
        // Ensure userId exists in the decoded token
        if (!decoded || !decoded.id) {
            return res.status(401).send('Invalid token: missing userId');
        }
        
        req.userId = decoded.id; // Attach user ID to request object
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('JWT verification failed:', error);
        return res.status(401).send('Invalid token');
    }
}