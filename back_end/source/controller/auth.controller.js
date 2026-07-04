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

export const sign_in = async (req, res) => {
    try {
        if (!process.env.JWT_SECRET) {
            return res.status(400).json({
                message: "JWT_PASS not definded",
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

        const passwordMatch = bcrypt.compareSync(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(400).json({
                message: "Wrong answer or email",
            })
        }

        const token = jwt.sign({
            id: user.id,
            email: user.email,
            username: user.username,
        }, process.env.JWT_SECRET, { expiresIn: '1d' }
        );

        const { password_hash, ...userSafe } = user;

        return res.status(200).json({
            message: "Login successfully",
            token,
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