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
            rm.content as reply_content, ru.username as reply_sender_name,
            COALESCE(
                (
                    SELECT json_agg(json_build_object(
                        'id', mr.id,
                        'user_id', mr.user_id,
                        'emoji', mr.emoji,
                        'username', ur.username,
                        'avatar_url', ur.avatar_url
                    ))
                    FROM message_reactions mr
                    JOIN users ur ON ur.id = mr.user_id
                    WHERE mr.message_id = m.id
                ), '[]'::json
            ) as reactions
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

export const editMessage = async (req, res) => {
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

export const deleteMessage = async (req, res) => {
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
        if (checkMember.rows[0].role === 'admin') {
            const oldestMember = await pool.query(`
                SELECT user_id
                FROM conversation_members
                WHERE conversation_id = $1 AND role = 'member'
                ORDER BY created_at
                LIMIT 1
            `, [conversationID]);
            if (oldestMember.rows.length !== 0) {
                const updateRoleAdmin = await pool.query(`
                    UPDATE conversation_members
                    SET role = 'admin'
                    WHERE conversation_id = $1 AND user_id = $2
                `, [conversationID, oldestMember.rows[0].user_id]);
            }
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
        const fileURL = req.file.path || req.file.secure_url;
        const isImage = req.file.mimetype ? req.file.mimetype.startsWith('image/') : true;
        const fileType = isImage ? 'image' : 'file';
        res.status(200).json({
            success: true,
            fileURL,
            fileType,
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

export const toggleReaction = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID, messageID } = req.params;
        const { emoji } = req.body;
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
        const exist = await pool.query(`
            SELECT id, emoji
            FROM message_reactions
            WHERE message_id = $1 AND user_id = $2
        `, [messageID, userID]);
        if (exist.rows.length > 0) {
            if (exist.rows[0].emoji === emoji) {
                await pool.query(`
                    DELETE FROM message_reactions
                    WHERE message_id = $1 AND user_id = $2
                `, [messageID, userID]);
            } else {
                await pool.query(`
                    UPDATE message_reactions
                    SET emoji = $3
                    WHERE message_id = $1 AND user_id = $2
                `, [messageID, userID, emoji]);
            }
        } else {
            await pool.query(`
                INSERT INTO message_reactions (message_id,user_id,emoji)
                VALUES ($1, $2, $3)
            `, [messageID, userID, emoji])
        }
        const result = await pool.query(`
            SELECT mr.id, mr.user_id, mr.emoji, u.username, u.avatar_url
            FROM message_reactions mr
            JOIN users u ON mr.user_id = u.id
            WHERE mr.message_id = $1
        `, [messageID])
        return res.status(200).json({
            success: true,
            message: "Toggle reaction success",
            messageID,
            reactions: result.rows
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const searchMessage = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const { content, limit = 20, offset = 0 } = req.query;

        if (!content) {
            return res.status(400).json({
                message: "Please fill content"
            })
        }

        const checkMember = await pool.query(`
            SELECT 1
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);
        if (checkMember.rows.length === 0) {
            return res.status(403).json({
                message: "You are not member of this conversation"
            })
        }

        const result = await pool.query(`
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id, m.content,
                m.type,
                m.created_at,
                u.username AS sender_name,
                u.avatar_url AS sender_avatar
            FROM messages m 
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
                AND m.content ILIKE $2
                AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
            LIMIT $3 OFFSET $4
        `, [conversationID, `%${content}%`, limit, offset]);
        return res.status(200).json({
            success: true,
            messages: result.rows
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const getMessagesContext = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID, messageID } = req.params;
        const checkMember = await pool.query(`
            SELECT 1
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);

        if (checkMember.rows.length === 0) {
            return res.status(403).json({
                message: "You are not member of this conversation"
            });
        }

        const targetMessage = await pool.query(`
            SELECT id, created_at
            FROM messages
            WHERE id = $1 AND conversation_id = $2
        `, [messageID, conversationID]);

        if (targetMessage.rows.length === 0) {
            return res.status(404).json({
                message: "Message not found"
            });
        }

        const targetID = targetMessage.rows[0].id;
        const targetCreate = targetMessage.rows[0].created_at;

        const messages = await pool.query(`
            SELECT * FROM (
                (
                    SELECT 
                        m.id, m.conversation_id, m.sender_id, m.content, m.type, m.file_url, m.created_at, m.edited_at, m.deleted_at, m.reply_to_id,
                        u.username as sender_name, u.avatar_url as sender_avatar,
                        rm.content as reply_content, ru.username as reply_sender_name,
                        COALESCE(
                            (
                                SELECT json_agg(json_build_object(
                                    'id', mr.id,
                                    'user_id', mr.user_id,
                                    'emoji', mr.emoji,
                                    'username', ur.username,
                                    'avatar_url', ur.avatar_url
                                ))
                                FROM message_reactions mr
                                JOIN users ur ON ur.id = mr.user_id
                                WHERE mr.message_id = m.id
                            ), '[]'::json
                        ) as reactions
                    FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    LEFT JOIN messages rm ON m.reply_to_id = rm.id
                    LEFT JOIN users ru ON ru.id = rm.sender_id
                    WHERE m.conversation_id = $1
                        AND (m.created_at < $2 OR (m.created_at = $2 AND m.id <= $3))
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 10
                )
                UNION ALL
                (
                    SELECT 
                        m.id, m.conversation_id, m.sender_id, m.content, m.type, m.file_url, m.created_at, m.edited_at, m.deleted_at, m.reply_to_id,
                        u.username as sender_name, u.avatar_url as sender_avatar,
                        rm.content as reply_content, ru.username as reply_sender_name,
                        COALESCE(
                            (
                                SELECT json_agg(json_build_object(
                                    'id', mr.id,
                                    'user_id', mr.user_id,
                                    'emoji', mr.emoji,
                                    'username', ur.username,
                                    'avatar_url', ur.avatar_url
                                ))
                                FROM message_reactions mr
                                JOIN users ur ON ur.id = mr.user_id
                                WHERE mr.message_id = m.id
                            ), '[]'::json
                        ) as reactions
                    FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    LEFT JOIN messages rm ON m.reply_to_id = rm.id
                    LEFT JOIN users ru ON ru.id = rm.sender_id
                    WHERE m.conversation_id = $1
                        AND (m.created_at > $2 OR (m.created_at = $2 AND m.id > $3))
                    ORDER BY m.created_at ASC, m.id ASC
                    LIMIT 10
                )
            ) AS combined_messages
            ORDER BY created_at ASC, id ASC
        `, [conversationID, targetCreate, targetID]);

        return res.status(200).json({
            success: true,
            messages: messages.rows
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
};

export const getMessagesBefore = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const { messageID, limit = 20 } = req.query;

        if (!messageID) {
            return res.status(400).json({ message: "messageID is required" });
        }

        const checkMember = await pool.query(`
            SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);
        if (checkMember.rows.length === 0) {
            return res.status(403).json({ message: "You are not member of this conversation" });
        }

        const result = await pool.query(`
            SELECT m.id, m.conversation_id, m.sender_id, m.content, m.type, m.file_url, m.created_at, m.edited_at, m.deleted_at, m.reply_to_id,
                   u.username as sender_name, u.avatar_url as sender_avatar,
                   rm.content as reply_content, ru.username as reply_sender_name,
                   COALESCE(
                       (
                           SELECT json_agg(json_build_object(
                               'id', mr.id, 'user_id', mr.user_id, 'emoji', mr.emoji, 'username', ur.username, 'avatar_url', ur.avatar_url
                           ))
                           FROM message_reactions mr JOIN users ur ON ur.id = mr.user_id WHERE mr.message_id = m.id
                       ), '[]'::json
                   ) as reactions
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            LEFT JOIN messages rm ON m.reply_to_id = rm.id
            LEFT JOIN users ru ON ru.id = rm.sender_id
            WHERE m.conversation_id = $1 
              AND m.id != $2::uuid
              AND m.created_at <= (SELECT created_at FROM messages WHERE id = $2::uuid)
            ORDER BY m.created_at DESC
            LIMIT $3
        `, [conversationID, messageID, parseInt(limit)]);

        return res.status(200).json({
            success: true,
            messages: result.rows.reverse()
        });
    } catch (err) {
        console.error("Error in getMessagesBefore:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const getMessagesAfter = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const { messageID, limit = 20 } = req.query;

        if (!messageID) {
            return res.status(400).json({ message: "messageID is required" });
        }

        const checkMember = await pool.query(`
            SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);
        if (checkMember.rows.length === 0) {
            return res.status(403).json({ message: "You are not member of this conversation" });
        }

        const result = await pool.query(`
            SELECT m.id, m.conversation_id, m.sender_id, m.content, m.type, m.file_url, m.created_at, m.edited_at, m.deleted_at, m.reply_to_id,
                   u.username as sender_name, u.avatar_url as sender_avatar,
                   rm.content as reply_content, ru.username as reply_sender_name,
                   COALESCE(
                       (
                           SELECT json_agg(json_build_object(
                               'id', mr.id, 'user_id', mr.user_id, 'emoji', mr.emoji, 'username', ur.username, 'avatar_url', ur.avatar_url
                           ))
                           FROM message_reactions mr JOIN users ur ON ur.id = mr.user_id WHERE mr.message_id = m.id
                       ), '[]'::json
                   ) as reactions
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            LEFT JOIN messages rm ON m.reply_to_id = rm.id
            LEFT JOIN users ru ON ru.id = rm.sender_id
            WHERE m.conversation_id = $1 
              AND m.id != $2::uuid
              AND m.created_at >= (SELECT created_at FROM messages WHERE id = $2::uuid)
            ORDER BY m.created_at ASC
            LIMIT $3
        `, [conversationID, messageID, parseInt(limit)]);

        return res.status(200).json({
            success: true,
            messages: result.rows
        });
    } catch (err) {
        console.error("Error in getMessagesAfter:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const getConversationImages = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const { limit = 9, offset = 0 } = req.query;

        const checkMember = await pool.query(`
            SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);
        if (checkMember.rows.length === 0) {
            return res.status(403).json({ message: "You are not member of this conversation" });
        }

        const countRes = await pool.query(`
            SELECT COUNT(*) FROM messages WHERE conversation_id = $1 AND type = 'image' AND deleted_at IS NULL
        `, [conversationID]);
        const total = parseInt(countRes.rows[0].count);

        const imagesRes = await pool.query(`
            SELECT id, content, file_url, created_at, sender_id
            FROM messages
            WHERE conversation_id = $1 AND type = 'image' AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [conversationID, parseInt(limit), parseInt(offset)]);

        return res.status(200).json({
            success: true,
            total,
            images: imagesRes.rows,
            hasMore: parseInt(offset) + imagesRes.rows.length < total
        });
    } catch (err) {
        console.error("Error in getConversationImages:", err);
        return res.status(500).json({ error: err.message });
    }
};

export const sendFriendRequest = async (req, res) => {
    try {
        const userID = req.user.id;
        const { receiveID } = req.body;
        if (userID === receiveID) {
            return res.status(400).json({
                message: "You can't send request to yourself"
            })
        }
        const checkFriend = await pool.query(`
            SELECT 1
            FROM friends
            WHERE (user1_id = $1 AND user2_id = $2) 
                OR (user1_id = $2 AND user2_id = $1)
        `, [userID, receiveID]);
        if (checkFriend.rows.length > 0) {
            return res.status(400).json({
                message: "You are already friend",
            })
        }
        const checkRequestFriend = await pool.query(`
            SELECT 1
            FROM friend_requests
            WHERE (sender_id = $1 AND receive_id = $2)
                OR (sender_id = $2 AND receive_id = $1)
        `, [userID, receiveID]);
        if (checkRequestFriend.rows.length > 0) {
            return res.status(400).json({
                message: "Exist friend request"
            })
        }
        await pool.query(`
            INSERT INTO friend_requests (sender_id, receive_id)
            VALUES ($1, $2)
        `, [userID, receiveID]);
        return res.status(200).json({
            success: true,
            message: "Friend request sent successfully"
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const acceptFriendRequest = async (req, res) => {
    let client;
    try {
        const userID = req.user.id;
        const { requestID } = req.body;

        if (!requestID) {
            return res.status(400).json({
                message: "requestID is required"
            });
        }

        const request = await pool.query(`
            SELECT * 
            FROM friend_requests
            WHERE id = $1 AND receive_id = $2
        `, [requestID, userID]);

        if (request.rows.length === 0) {
            return res.status(400).json({
                message: "Friend request not found or invalid",
            });
        }

        const senderID = request.rows[0].sender_id;

        const checkFriend = await pool.query(`
            SELECT 1
            FROM friends
            WHERE (user1_id = $1 AND user2_id = $2) 
                OR (user1_id = $2 AND user2_id = $1)
        `, [userID, senderID]);

        if (checkFriend.rows.length > 0) {
            return res.status(400).json({
                message: "You are already friend",
            });
        }

        client = await pool.connect();
        await client.query(`BEGIN`);

        await client.query(`
            INSERT INTO friends (user1_id, user2_id)
            VALUES ($1, $2)
        `, [userID, senderID]);

        await client.query(`
            DELETE FROM friend_requests
            WHERE id = $1
        `, [requestID]);

        await client.query(`COMMIT`);

        return res.status(200).json({
            success: true,
            message: "Accept friend request successfully"
        });
    } catch (err) {
        if (client) await client.query(`ROLLBACK`);
        return res.status(500).json({
            error: err.message
        });
    } finally {
        if (client) client.release();
    }
}

export const rejectFriendRequest = async (req, res) => {
    try {
        const userID = req.user.id;
        const { requestID } = req.body;

        if (!requestID) {
            return res.status(400).json({
                message: "requestID is required"
            });
        }

        const request = await pool.query(`
            SELECT * 
            FROM friend_requests
            WHERE id = $1 AND receive_id = $2
        `, [requestID, userID]);

        if (request.rows.length === 0) {
            return res.status(400).json({
                message: "Friend request not found or invalid",
            });
        }

        await pool.query(`
            DELETE FROM friend_requests
            WHERE id = $1 AND receive_id = $2
        `, [requestID, userID]);

        return res.status(200).json({
            success: true,
            message: "Reject friend request successfully"
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}

export const cancelFriendRequest = async (req, res) => {
    try {
        const userID = req.user.id;
        const { requestID } = req.body;
        const existRequest = await pool.query(`
            SELECT 1
            FROM friend_requests
            WHERE id = $1 AND sender_id = $2
        `, [requestID, userID]);
        if (existRequest.rows.length === 0) {
            return res.status(400).json({
                message: "Friend request not found or valid"
            })
        }
        await pool.query(`
            DELETE FROM friend_requests
            WHERE id = $1 AND sender_id = $2
        `, [requestID, userID]);
        return res.status(200).json({
            success: true,
            message: "Cancle friend request successfully"
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const removeFriend = async (req, res) => {
    try {
        const userID = req.user.id;
        const { friendID } = req.params;
        const exitstFriend = await pool.query(`
            SELECT 1
            FROM friends
            WHERE (user1_id = $1 AND user2_id = $2)
                OR (user1_id = $2 AND user2_id = $1)
        `, [userID, friendID]);
        if (exitstFriend.rows.length === 0) {
            return res.status(400).json({
                message: "Friend not found"
            })
        }
        await pool.query(`
            DELETE FROM friends
            WHERE (user1_id = $1 AND user2_id = $2)
                OR (user1_id = $2 AND user2_id = $1)
        `, [userID, friendID]);
        return res.status(200).json({
            success: true,
            message: "Remove friend successfully"
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const getListFriend = async (req, res) => {
    try {
        const userID = req.user.id;
        const sortOrder = req.query.sortOrder || 'ASC';
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;

        if (sortOrder.toUpperCase() != 'ASC' && sortOrder.toUpperCase() != 'DESC') {
            return res.status(400).json({
                message: "Invalid sort order"
            })
        }
        let lstFriend;
        if (sortOrder.toUpperCase() === 'ASC') {
            lstFriend = await pool.query(`
            SELECT 
                u.id AS friend_id,
                u.username AS friend_name,
                u.avatar_url AS friend_avatar
            FROM friends f
            JOIN users u 
            ON (f.user1_id = u.id OR f.user2_id = u.id)
            WHERE (
                (f.user1_id = $1 AND u.id != $1)
                OR (f.user2_id = $1 AND u.id != $1)
            )
            ORDER BY LOWER(u.username) ASC
            LIMIT $2 OFFSET $3
        `, [userID, limit, offset]);
        } else {
            lstFriend = await pool.query(`
            SELECT 
                u.id AS friend_id,
                u.username AS friend_name,
                u.avatar_url AS friend_avatar
            FROM friends f
            JOIN users u 
            ON (f.user1_id = u.id OR f.user2_id = u.id)
            WHERE (
                (f.user1_id = $1 AND u.id != $1)
                OR (f.user2_id = $1 AND u.id != $1)
            )
            ORDER BY LOWER(u.username) DESC
            LIMIT $2 OFFSET $3
        `, [userID, limit, offset]);
        }
        return res.status(200).json({
            success: true,
            friends: lstFriend.rows
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const getListFriendRequest = async (req, res) => {
    try {
        const userID = req.user.id;
        const sortOrder = req.query.sortOrder || 'ASC';
        const limit = req.query.limit || 50;
        const offset = req.query.offset || 0;

        let lstFriendRequest;
        if (sortOrder.toUpperCase() === 'ASC') {
            lstFriendRequest = await pool.query(`
                SELECT 
                    u.id AS sender_id,
                    u.username AS sender_name,
                    u.avatar_url AS sender_avatar,
                    fr.id AS request_id,
                    fr.status AS request_status,
                    fr.created_at AS request_created_at
                FROM friend_requests fr
                JOIN users u
                    ON (fr.sender_id = u.id)
                WHERE fr.receive_id = $1
                ORDER BY fr.created_at ASC
                LIMIT $2 OFFSET $3
            `, [userID, limit, offset])
        } else {
            lstFriendRequest = await pool.query(`
                SELECT 
                    u.id AS sender_id,
                    u.username AS sender_name,
                    u.avatar_url AS sender_avatar,
                    fr.id AS request_id,
                    fr.status AS request_status,
                    fr.created_at AS request_created_at
                FROM friend_requests fr
                JOIN users u
                    ON (fr.sender_id = u.id)
                WHERE fr.receive_id = $1
                ORDER BY fr.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userID, limit, offset])
        }
        return res.status(200).json({
            success: true,
            friendRequests: lstFriendRequest.rows
        })
    } catch (err) {
        return res.status(500).json({
            error: err.message
        })
    }
}

export const changeAdminRole = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;
        const newAdminID = req.body.newAdminID || req.body.newAdmin;

        if (!newAdminID) {
            return res.status(400).json({
                message: "Please specify new admin ID"
            });
        }

        const checkAdmin = await pool.query(`
            SELECT role
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2 
        `, [conversationID, userID]);

        if (checkAdmin.rows.length === 0) {
            return res.status(401).json({
                message: "You are not a member of this conversation"
            });
        }

        if (checkAdmin.rows[0].role !== 'admin') {
            return res.status(403).json({
                message: "You are not admin in this conversation"
            });
        }

        const checkNewAdmin = await pool.query(`
            SELECT 1
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2 
        `, [conversationID, newAdminID]);

        if (checkNewAdmin.rows.length === 0) {
            return res.status(400).json({
                message: "New admin is not a member of this conversation"
            });
        }

        await pool.query(`
            UPDATE conversation_members
            SET role = 'member'
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);

        await pool.query(`
            UPDATE conversation_members
            SET role = 'admin'
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, newAdminID]);

        return res.status(200).json({
            success: true,
            message: "Updated admin role successfully"
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        });
    }
};

export const disbandGroup = async (req, res) => {
    try {
        const userID = req.user.id;
        const { conversationID } = req.params;

        const checkAdmin = await pool.query(`
            SELECT role
            FROM conversation_members
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationID, userID]);

        if (checkAdmin.rows.length === 0 || checkAdmin.rows[0].role !== 'admin') {
            return res.status(403).json({
                message: "Only admin can disband group"
            });
        }

        await pool.query(`
            DELETE FROM conversations
            WHERE id = $1 AND type = 'group'
        `, [conversationID]);

        return res.status(200).json({
            success: true,
            message: "Group disbanded successfully"
        });
    } catch (err) {
        return res.status(500).json({
            error: err.message,
        });
    }
};