import pool from '../db/pool.js';
import { disconnectBannedUser } from '../socket.js';

export const getSystemStats = async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        const bannedUsersCount = await pool.query('SELECT COUNT(*) FROM users WHERE is_banned = TRUE');
        const adminUsersCount = await pool.query("SELECT COUNT(*) FROM users WHERE system_role = 'admin'");
        const conversationsCount = await pool.query('SELECT COUNT(*) FROM conversations');
        const groupsCount = await pool.query("SELECT COUNT(*) FROM conversations WHERE type = 'group'");
        const messagesCount = await pool.query('SELECT COUNT(*) FROM messages');

        return res.status(200).json({
            success: true,
            stats: {
                totalUsers: parseInt(usersCount.rows[0].count, 10),
                bannedUsers: parseInt(bannedUsersCount.rows[0].count, 10),
                adminUsers: parseInt(adminUsersCount.rows[0].count, 10),
                totalConversations: parseInt(conversationsCount.rows[0].count, 10),
                totalGroups: parseInt(groupsCount.rows[0].count, 10),
                totalMessages: parseInt(messagesCount.rows[0].count, 10),
            }
        });
    } catch (err) {
        console.error("Error getSystemStats:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const { q = '', limit = 20, offset = 0 } = req.query;

        let query = `
            SELECT id, username, email, avatar_url, status_message, system_role, is_banned, created_at
            FROM users
        `;
        const queryParams = [];

        if (q.trim()) {
            query += ` WHERE username ILIKE $1 OR email ILIKE $1`;
            queryParams.push(`%${q.trim()}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, offset);

        const result = await pool.query(query, queryParams);

        const totalCountRes = await pool.query(
            q.trim()
                ? `SELECT COUNT(*) FROM users WHERE username ILIKE $1 OR email ILIKE $1`
                : `SELECT COUNT(*) FROM users`,
            q.trim() ? [`%${q.trim()}%`] : []
        );

        return res.status(200).json({
            success: true,
            users: result.rows,
            total: parseInt(totalCountRes.rows[0].count, 10)
        });
    } catch (err) {
        console.error("Error getAllUsers:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};


export const toggleBanUser = async (req, res) => {
    try {
        const { targetUserID } = req.params;
        const currentAdminID = req.user.id;

        if (targetUserID === currentAdminID) {
            return res.status(400).json({ message: "You cannot ban your own account" });
        }

        const userRes = await pool.query('SELECT is_banned, username FROM users WHERE id = $1', [targetUserID]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "Target user not found" });
        }

        const newBanStatus = !userRes.rows[0].is_banned;

        await pool.query('UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2', [newBanStatus, targetUserID]);

        if (newBanStatus) {
            disconnectBannedUser(targetUserID);
        }

        return res.status(200).json({
            success: true,
            message: newBanStatus ? `User ${userRes.rows[0].username} has been banned` : `User ${userRes.rows[0].username} has been unbanned`,
            is_banned: newBanStatus
        });
    } catch (err) {
        console.error("Error toggleBanUser:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const changeSystemRole = async (req, res) => {
    try {
        const { targetUserID } = req.params;
        const { newRole } = req.body;
        const currentAdminID = req.user.id;

        if (targetUserID === currentAdminID) {
            return res.status(400).json({ message: "You cannot change your own system role" });
        }

        if (!['user', 'admin'].includes(newRole)) {
            return res.status(400).json({ message: "Invalid role. Role must be 'user' or 'admin'" });
        }

        await pool.query('UPDATE users SET system_role = $1, updated_at = NOW() WHERE id = $2', [newRole, targetUserID]);

        return res.status(200).json({
            success: true,
            message: `System role updated to ${newRole}`
        });
    } catch (err) {
        console.error("Error changeSystemRole:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const getAllConversations = async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const result = await pool.query(`
            SELECT 
                c.id,
                c.type,
                c.name,
                c.avatar_url,
                c.created_at,
                c.updated_at,
                u.username AS creator_name,
                COUNT(DISTINCT cm.user_id) AS member_count,
                COUNT(DISTINCT m.id) AS message_count
            FROM conversations c
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN conversation_members cm ON c.id = cm.conversation_id
            LEFT JOIN messages m ON c.id = m.conversation_id
            GROUP BY c.id, u.username
            ORDER BY c.updated_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const totalRes = await pool.query('SELECT COUNT(*) FROM conversations');

        return res.status(200).json({
            success: true,
            conversations: result.rows,
            total: parseInt(totalRes.rows[0].count, 10)
        });
    } catch (err) {
        console.error("Error getAllConversations:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

export const getAdminConversationMessages = async (req, res) => {
    try {
        const { conversationID } = req.params;
        const { limit = 30, offset = 0 } = req.query;

        const result = await pool.query(`
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                m.content,
                m.type,
                m.file_url,
                m.created_at,
                m.edited_at,
                m.deleted_at,
                u.username AS sender_name,
                u.avatar_url AS sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
        `, [conversationID, limit, offset]);

        return res.status(200).json({
            success: true,
            messages: result.rows.reverse()
        });
    } catch (err) {
        console.error("Error getAdminConversationMessages:", err);
        return res.status(500).json({ message: "Internal server error", error: err.message });
    }
};
