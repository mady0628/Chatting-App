import pool from '../db/pool.js';

export const requireSystemAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Verify system_role from DB directly for maximum security
        const userResult = await pool.query('SELECT system_role, is_banned FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userResult.rows[0];

        if (user.is_banned) {
            return res.status(403).json({ message: "Account is banned" });
        }

        if (user.system_role !== 'admin') {
            return res.status(403).json({ message: "Access denied: System Admin privilege required" });
        }

        next();
    } catch (err) {
        console.error("Admin middleware error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};
