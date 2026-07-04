import pool from "../db/pool.js";

export const getUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const currentUserId = req.user.id;

        if (!q || !currentUserId) {
            return res.status(400).json({
                message: "invalid query or userId"
            })
        }

        const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE username ILIKE $1', [`%${q}%`]);
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