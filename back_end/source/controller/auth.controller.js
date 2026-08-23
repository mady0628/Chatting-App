import pool from "../db/pool.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const sign_up = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({
                error: "Please fill full information",
            })
        }

        const userExit = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExit.rows.length > 0) {
            return res.status(400).json({
                message: 'User exist',
            })
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        const result = await pool.query('INSERT INTO users (username,email,password_hash) VALUES ($1,$2,$3) RETURNING *', [username, email, passwordHash]);
        const { password_hash, ...userSafe } = result.rows[0];
        return res.status(201).json({
            message: "Create Success",
            user: userSafe,
        })
    } catch (err) {
        console.error("Sign-up error:", err);
        return res.status(500).json({
            message: "Internal server error",
            error: err.message || err,
        })
    }

}

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user.id, email: user.email, username: user.username, system_role: user.system_role || 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

export const sign_in = async (req, res) => {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(400).json({
                message: "JWT_SECRET not defined",
            })
        }
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "Please fill full information",
            })
        }

        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(400).json({
                message: "User not found",
            })
        }

        const user = userResult.rows[0];

        if (user.is_banned) {
            return res.status(403).json({
                message: "Tài khoản của bạn đã bị khóa bởi Quản trị viên!",
            });
        }

        const passwordMatch = bcrypt.compareSync(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(400).json({
                message: "Wrong answer or email",
            })
        }

        const { accessToken, refreshToken } = generateTokens(user);

        // Send refreshToken in HttpOnly Cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        const { password_hash, ...userSafe } = user;

        return res.status(200).json({
            message: "Login successfully",
            token: accessToken,
            accessToken,
            user: userSafe,
        })
    } catch (err) {
        console.error("Sign-in error:", err);
        return res.status(500).json({
            message: "Internal server error",
            error: err.message || err,
        })
    }
}

export const refresh_token = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: "No refresh token provided" });
        }

        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET
        );

        const userResult = await pool.query('SELECT id, username, email, avatar_url, status_message, system_role, is_banned FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userResult.rows[0];
        if (user.is_banned) {
            return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa!" });
        }

        const newAccessToken = jwt.sign(
            { id: user.id, email: user.email, username: user.username, system_role: user.system_role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        return res.status(200).json({
            token: newAccessToken,
            accessToken: newAccessToken,
            user
        });
    } catch (err) {
        console.error("Refresh token error:", err.message);
        return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        return res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout error" });
    }
};