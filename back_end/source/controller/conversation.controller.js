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