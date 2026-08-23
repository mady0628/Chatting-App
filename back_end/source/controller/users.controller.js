import pool from "../db/pool.js";
import bcrypt from 'bcrypt';

export const getUsers = async (req, res) => {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        const currentUserId = req.user.id;

        if (!q || !currentUserId) {
            return res.status(400).json({
                message: "invalid query or userId"
            })
        }

        const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE username ILIKE $1 LIMIT $2 OFFSET $3', [`%${q}%`, limit, offset]);
        res.status(200).json({
            success: true,
            data: result.rows,
            userid: currentUserId,
        })
    } catch (err) {
        console.error("search error", err);
        return res.status(500).json({
            message: "Internal server error",
            error: err.message,
        })
    }
}

export const updateProfile = async (req, res) => {
    try {
        const userID = req.user.id;
        const { newUsername } = req.body;
        const avatarUrl = req.file ? req.file.path : null;
        const result = await pool.query(`
            UPDATE users
            SET username = COALESCE($1, username),
                avatar_url = COALESCE($2, avatar_url),
                updated_at = NOW()
            WHERE id = $3
            RETURNING id, username, email, avatar_url
        `, [newUsername, avatarUrl, userID]);
        res.status(200).json({
            success: true,
            user: result.rows[0]
        })
    } catch (err) {
        res.status(500).json({
            error: err.message
        })
    }
}

export const changePassword = async (req, res) => {
    try {
        const userID = req.user.id;
        const { oldPassword, newPassword } = req.body;
        const hashPassword = await pool.query(`
            SELECT password_hash
            FROM users
            WHERE id = $1
        `, [userID]);

        if (hashPassword.rows.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            })
        }

        const isCompare = await bcrypt.compare(oldPassword, hashPassword.rows[0].password_hash);
        if (!isCompare) {
            return res.status(400).json({
                message: "Old password wrong"
            })
        }

        const newHashPassword = await bcrypt.hash(newPassword, 10);
        const result = await pool.query(`
            UPDATE users
            SET password_hash = $1,
                updated_at = NOW()
            WHERE id = $2
        `, [newHashPassword, userID]);
        res.status(200).json({
            message: "update password success"
        })

    } catch (err) {
        return res.status(500).json({
            error: err.message,
        })
    }
}