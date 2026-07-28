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
                u.id AS other_user_id,
                (
                    SELECT m.content
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message,
                (
                    SELECT m.sender_id
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message_sender_id,
                (
                    SELECT u.username
                    FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message_sender_name,
                (
                    SELECT m.type
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message_type,
                (
                    SELECT m.created_at
                    FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) AS last_message_time,
                (
                    SELECT COUNT(*)::int
                    FROM messages m
                    WHERE m.conversation_id = c.id
                        AND m.sender_id !=$1
                        AND (
                            cm1.last_read_message_id IS NULL
                            OR m.created_at > (SELECT created_at FROM messages WHERE id=cm1.last_read_message_id)
                        )
                ) AS unread_count
                
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
            m.id, m.conversation_id, m.sender_id, m.content, m.type, m.file_url, m.created_at, m.edited_at, m.deleted_at,m.reply_to_id,
            u.username as sender_name, u.avatar_url as sender_avatar,
            rm.content as reply_content, ru.username as reply_sender_name
            FROM messages m
            JOIN users u
            ON u.id = m.sender_id
            LEFT JOIN messages rm ON m.reply_to_id = rm.id
            LEFT JOIN users ru ON ru.id = rm.sender_id
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

export const getConversationMembers = async (req, res) => {
    try {
        const { conversationID } = req.params;
        const userID = req.user.id;
        const checkmember = await pool.query(`
            SELECT * 
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID])
        if (checkmember.rows.length === 0) {
            return res.status(403).json({
                message: "You are not member of this conversation",
            })
        }

        const member = await pool.query(`
            SELECT u.id, u.username, u.avatar_url, cm.role, cm.last_read_message_id
            FROM conversation_members cm
            JOIN users u
            ON u.id = cm.user_id
            WHERE conversation_id = $1
        `, [conversationID]);
        return res.status(200).json({
            message: "Get list member success",
            member: member.rows,
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        })
    }
}

//update last_message_id, unread_count when open conversation
export const markAsRead = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;

        const lastMessage = await pool.query(`
            SELECT id
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [conversationID])
        if (lastMessage.rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "no message in conversation"
            })
        }
        const lastMessageID = lastMessage.rows[0].id;

        await pool.query(`
            UPDATE conversation_members
            SET last_read_message_id = $1
            WHERE conversation_id = $2 AND user_id = $3
        `, [lastMessageID, conversationID, userID]);
        return res.status(200).json({
            success: true,
            message: "mark as read success",
            lastReadMessageID: lastMessageID
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        })
    }
}

export const editMessage = async (req) => {
    try {
        const userID = req.user.id;
        const { messageID } = req.params;
        const { content } = req.body;
        const editMessage = await pool.query(`
            UPDATE messages
            SET content = $1, edited_at = NOW()
            WHERE id = $2 and sender_id = $3
            RETURNING id, content, edited_at
        `, [content, messageID, userID]);
        return res.status(200).json({
            success: true,
            message: "Message edited successfully",
            editedMessage: editMessage,
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        })
    }
}

export const deleteMessage = async (req) => {
    try {
        const userID = req.user.id;
        const { messageID } = req.params;
        const deleteMessage = await pool.query(`
            UPDATE messages
            SET deleted_at = NOW()
            WHERE id = $1 AND sender_id = $2
            RETURNING *
        `, [messageID, userID]);
        return res.status(200).json({
            success: true,
            message: "Message deleted successfully",
            deletedMessage: deleteMessage
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        })
    }
}

export const removeMember = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID, targetUserID } = req.params;

        const checkMemberInConversation = await pool.query(`
            SELECT *
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2;
        `, [conversationID, userID])
        if (checkMemberInConversation.rows.length === 0) {
            return res.status(403).json({
                message: "You are not member of this conversation",
            })
        }

        const checkRoleUser = await pool.query(`
            SELECT role
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin'
        `, [conversationID, userID]);
        if (checkRoleUser.rows.length === 0) {
            return res.status(403).json({
                message: "You are not admin of this conversation"
            })
        }

        if (String(targetUserID) === String(userID)) {
            return res.status(400).json({
                message: "You can't remove yourself in this conversation"
            })
        }

        const removeUser = await pool.query(`
            DELETE
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
            RETURNING *
        `, [conversationID, targetUserID]);

        if (removeUser.rows.length === 0) {
            return res.status(404).json({
                message: "User not found",
            })
        }

        return res.status(200).json({
            success: true,
            message: "Remove user successfully",
            conversationID,
            targetUserID
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        })
    }
}

export const leaveGroup = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const checkMember = await pool.query(`
            SELECT *
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID])
        if (checkMember.rows.length === 0) {
            return res.status(401).json({
                message: "you are not in this conversation",
            })
        }
        const leaveConversation = await pool.query(`
            DELETE
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
            RETURNING conversation_id, user_id
        `, [conversationID, userID]);
        res.status(200).json({
            success: true,
            message: "Leave conversation successfully",
            conversationID: leaveConversation.rows[0].conversation_id,
            userID: leaveConversation.rows[0].user_id,
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        })
    }
}

export const addMemberToConversation = async (req, res) => {
    try {
        const { conversationID } = req.params;
        const { targetIDs } = req.body;
        for (const targetID of targetIDs) {
            await pool.query(`
                INSERT INTO conversation_members (conversation_id, user_id)
                VALUES($1,$2)
                ON CONFLICT (conversation_id, user_id) DO NOTHING
            `, [conversationID, targetID]);
        }
        res.status(200).json({
            success: true,
            message: "Add member successfully",
            conversationID,
            targetIDs
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        })
    }
}

export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Please upload file"
            })
        }
        const fileURL = req.file.path;
        res.status(200).json({
            success: true,
            fileURL,
            fileType: 'image',
            fileName: req.file.originalname
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
}

export const updateGroupProfile = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const { name } = req.body;
        const avatar_url = req.body.avatar_url || (req.file ? req.file.path : null);
        const checkMember = await pool.query(`
            SELECT *
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);
        if (checkMember.rows.length === 0) {
            return res.status(403).json({
                message: "You are not member of this conversation",
            })
        }
        const updateProfile = await pool.query(`
            UPDATE conversations
            SET name = COALESCE($1,name),
                avatar_url = COALESCE($2,avatar_url),
                updated_at = NOW()
            WHERE id = $3
            RETURNING id, name AS group_name, avatar_url AS group_avatar
        `, [name, avatar_url, conversationID]);
        if (updateProfile.rows.length === 0) {
            return res.status(404).json({
                message: "Can't find the conversation"
            })
        }
        res.status(200).json({
            success: true,
            message: "Update group profile successs",
            data: updateProfile.rows[0]
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
}

export const getListPinnedMessage = async (conversationID) => {
    const result = await pool.query(`
            SELECT
                pm.id AS pin_id,
                pm.message_id,
                pm.created_at AS pinned_at,
                m.content,
                m.type,
                m.created_at AS message_created_at,
                u.username AS sender_name
            FROM pinned_messages pm
            JOIN messages m ON m.id = pm.message_id
            JOIN users u ON u.id = m.sender_id
            WHERE pm.conversation_id = $1
            ORDER BY pm.created_at DESC
        `, [conversationID]);
    return result.rows;
}

export const getPinnedMessage = async (req, res) => {
    try {
        const { conversationID } = req.params;
        const pinnedList = await getListPinnedMessage(conversationID);
        return res.status(200).json({
            success: true,
            message: "Get pinned message successfully",
            pinnedList
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const pinMessage = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID, messageID } = req.params;
        const checkMember = await pool.query(`
            SELECT *
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);
        if (checkMember.rows.length === 0) {
            return res.status(403).json({
                message: "You are not member of this conversation"
            })
        }

        const result = await pool.query(`
            INSERT INTO pinned_messages (conversation_id, message_id, pinned_by)
            VALUES ($1,$2,$3)
            ON CONFLICT (conversation_id, message_id) DO NOTHING
        `, [conversationID, messageID, userID]);

        const pinnedList = await getListPinnedMessage(conversationID);
        return res.status(200).json({
            success: true,
            message: "Pinned message successfully",
            pinnedList
        })
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
}

export const unpinMessage = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID, messageID } = req.params;
        await pool.query(`
            DELETE FROM pinned_messages
            WHERE conversation_id = $1 AND message_id = $2
        `, [conversationID, messageID]);
        const pinnedList = await getListPinnedMessage(conversationID);
        return res.status(200).json({
            success: true,
            message: "Unpin message success",
            pinnedList
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}