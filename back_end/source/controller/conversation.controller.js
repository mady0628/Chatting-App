import pool from "../db/pool.js";

export const createConversation = async (req, res) => {
    try {
        const { targetID } = req.body;
        const currentUserId = req.user.id;

        if (!targetID) {
            return res.status(400).json({
                message: "invalid targetID"
            })
        }

        if (targetID === currentUserId) {
            return res.status(400).json({
                message: "You can't create conversation with yourself"
            })
        }

        const existconversation = await pool.query(
            `
            SELECT c.*
            FROM conversations c
            JOIN conversation_members cm1 ON c.id = cm1.conversation_id
            JOIN conversation_members cm2 ON c.id = cm2.conversation_id
            WHERE cm1.user_id = $1 AND cm2.user_id = $2 AND c.type = 'direct'
            `, [currentUserId, targetID]
        )
        if (existconversation.rows.length > 0) {
            return res.status(400).json({
                message: "Conversation exists",
                conversationID: existconversation.rows[0].id
            })
        }


        const result = await pool.query(
            `
            INSERT INTO conversations (type)
            VALUES ('direct')
            RETURNING id
            `
        )
        const conversationID = result.rows[0].id;
        const insertMember = await pool.query(
            `
            INSERT INTO conversation_members (conversation_id,user_id)
            VALUES ($1,$2),($1,$3)
            `
            , [conversationID, currentUserId, targetID]
        )
        res.status(201).json({
            message: "Conversation created",
            conversationID: conversationID
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            message: err.message,
        })
    }
}

export const creatGroupConversation = async (req, res) => {
    let client
    try {
        client = await pool.connect();
        const { nameGroup, memberIDs } = req.body;
        const currentID = req.user.id;

        if (!nameGroup) {
            return res.status(400).json({
                message: "Please fill Name Group",
            })
        }
        if (!memberIDs || memberIDs.length === 0) {
            return res.status(400).json({
                message: "Please add member",
            })
        }
        await client.query("BEGIN")
        const result = await client.query(`
            INSERT INTO conversations (type,name,created_by)
            VALUES ('group',$1,$2)
            RETURNING id;
        `, [nameGroup, currentID]);
        const conversationID = result.rows[0].id;
        const insertAdmin = await client.query(`
            INSERT INTO conversation_members(conversation_id,user_id,role)
            VALUES ($1, $2, 'admin')
        `, [conversationID, currentID])
        for (const userID of memberIDs) {
            if (userID != currentID) {
                const insertMember = await client.query(`
                    INSERT INTO conversation_members(conversation_id,user_id)
                    VALUES ($1, $2)
                `, [conversationID, userID])
            }
        }
        await client.query('COMMIT');
        res.status(201).json({
            message: "Create conversation success",
            conversationID: conversationID,
        })
    } catch (err) {
        await client.query('ROLLBACK')
        res.status(500).json({
            message: err.message,
        })
    } finally {
        if (client) {
            client.release();
        }
    }
}

export const getListConversations = async (req, res) => {
    try {
        const userID = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const conversations = await pool.query(`
            SELECT
                c.id,
                c.name AS group_name,
                c.type,
                c.avatar_url AS group_avatar,
                u.username AS other_user_name,
                u.avatar_url AS other_user_avatar,
                (
                    SELECT m.content
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT m.created_at
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message_time
                
            FROM conversations c
            JOIN conversation_members cm1 
                ON c.id = cm1.conversation_id
                AND cm1.user_id = $1
            LEFT JOIN conversation_members cm 
                ON c.id = cm.conversation_id
                AND cm.user_id !=$1
                AND c.type = 'direct'
            LEFT JOIN users u
                ON cm.user_id = u.id
            ORDER BY c.updated_at DESC
            LIMIT $2 OFFSET $3
        `, [userID, limit, offset])
        res.status(200).json({
            message: "Get list conversation success",
            conversations: conversations.rows,
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        })
    }
}

export const getMessages = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const checkUserInConversation = await pool.query(`
            SELECT c.id
            FROM conversations c
            JOIN conversation_members cm
                ON c.id = cm.conversation_id
                AND cm.user_id = $1
            WHERE c.id = $2   
        `, [userID, conversationID])

        if (checkUserInConversation.rows.length == 0) {
            return res.status(404).json({
                message: "Conversation not found",
            })
        }

        const messages = await pool.query(
            `
            SELECT
            m.id, m.conversation_id, m.content, m.type, m.file_url, m.created_at,
            u.username as sender_name, u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u
            ON u.id = m.sender_id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
            `, [conversationID, limit, offset]
        )
        return res.status(200).json({
            message: "Get message succes",
            messages: messages.rows,
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        })
    }
}

