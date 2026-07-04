import jwt from "jsonwebtoken"

export const authMiddleware = (req, res, next) => {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(400).json({
                message: "JWT_SECRET not defined",
            })
        }

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(400).json({
                message: "Don't have token"
            })
        }

        const token = authHeader.split(' ')[1]; // tách để lấy token
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decode;
        next();
    } catch (err) {
        console.error("Auth error:", err);
        return res.status(400).json({
            message: "Invalid token",
            error: err.message || err,
        })
    }

}