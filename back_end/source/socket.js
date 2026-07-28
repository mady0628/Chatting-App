import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from './db/pool.js'

const onlineUser = new Map();

export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:5173",
            methods: ["GET", "POST"]
        }
    });

    //middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token || !token.startsWith("Bearer ")) {
                return next(new Error("Authentication error: No token provided"));
            }

            const rightToken = token.split(" ")[1];
            const decode = jwt.verify(rightToken, process.env.JWT_SECRET);

            socket.user = decode;
            next();
        } catch (err) {
            console.error("Socket authentication failed:", err.message);
            return next(new Error("Authentication error: Invalid token"));
        }
    });

    //listen for user connect
    io.on('connection', async (socket) => {
        const userID = socket.user.id;
        console.log(`User connect: ${socket.user.username || userID}. UserID: ${userID}`);

        //user online
        const strUserID = String(userID);
        onlineUser.set(strUserID, socket.id);

        // Gửi danh sách các user đang online cho client mới kết nối
        socket.emit('get_online_users', Array.from(onlineUser.keys()));

        // Thông báo cho các client khác user này vừa online
        io.emit('user_online', strUserID);

        try {
            const userConversations = await pool.query(`
                SELECT conversation_id
                FROM conversation_members
                WHERE user_id = $1
            `, [userID])
            userConversations.rows.forEach(conv => {
                socket.join(`conversation:${conv.conversation_id}`);
                console.log(`Socket ${socket.id} auto join room: conversation:${conv.conversation_id}`)
            })
        } catch (err) {
            console.log('Error join room:', err.message);
        }

        //create conversation
        socket.on('create_conversation', async (data) => {
            try {
                const { conversationID, memberIDs } = data;
                socket.join(`conversation:${conversationID}`);
                const result = await pool.query(`
                    SELECT
                        c.id,
                        c.name AS group_name,
                        c.type,
                        c.avatar_url AS group_avatar,
                        u.username AS other_user_name,
                        u.avatar_url AS other_user_avatar,
                        u.id AS other_user_id
                    FROM conversations c
                    LEFT JOIN conversation_members cm
                        ON c.id = cm.conversation_id
                        AND cm.user_id !=$1
                        AND c.type = 'direct'
                    LEFT JOIN users u ON cm.user_id = u.id
                    WHERE c.id = $2
                `, [userID, conversationID]);
                if (result.rows.length > 0) {
                    const convData = result.rows[0];
                    memberIDs.forEach(mID => {
                        const socketId = onlineUser.get(String(mID));
                        if (socketId) {
                            io.to(socketId).emit('new_conversation', convData);
                        }
                    })
                }
            } catch (err) {
                console.error('Error socket create_conversation:', err.message)
            }
        })

        //client join a conversation
        socket.on('join_conversation', async (conversationID) => {
            try {
                const checkMember = await pool.query(`
                    SELECT 1 FROM conversation_members
                    WHERE conversation_id = $1 AND user_id = $2
                `, [conversationID, userID]);

                if (checkMember.rows.length === 0) {
                    socket.emit("error", "You are not a member of this conversation");
                    return;
                }
                socket.join(`conversation:${conversationID}`)
                console.log(`Socket ${socket.id} joined conversation: ${conversationID}`);
            } catch (err) {
                console.error(err.message);
                socket.emit('message_error', 'Error when join conversation')
            }
        });

        socket.on('leave_conversation', async (conversationID) => {
            try {
                socket.leave(`conversation:${conversationID}`);
                console.log(`Socket: ${socket.id} left conversation: ${conversationID}`);
            } catch (err) {
                console.error(err.message);
                socket.emit('message_error', 'Error when leave conversation')
            }
        })
        //send message
        socket.on('send_message', async (data) => {
            try {
                const { conversationID, content, type = 'text', replyToID } = data;
                const checkMember = await pool.query(`
                    SELECT 1 FROM conversation_members
                    WHERE conversation_id = $1 AND user_id = $2
                `, [conversationID, userID]);
                if (checkMember.rows.length === 0) {
                    console.log('User not in conversation');
                    socket.emit('message_error', 'You are not in conversation');
                    return;
                }
                const result = await pool.query(`
                    INSERT INTO messages(conversation_id, sender_id, content, type, reply_to_id)
                    VALUES ($1,$2,$3,$4, $5)
                    RETURNING id, conversation_id, sender_id, content, type, reply_to_id, created_at
                `, [conversationID, userID, content, type, replyToID || null]);

                const newMessage = result.rows[0];

                const senderResult = await pool.query(`
                    SELECT username, avatar_url FROM users
                    WHERE id = $1`, [userID]);
                let replyInfo = {};
                if (replyToID != null) {
                    const replyRes = await pool.query(`
                        SELECT m.content as reply_content, u.username as reply_sender_name
                        FROM messages m
                        JOIN users u
                        ON u.id = m.sender_id
                        WHERE m.id = $1
                    `, [replyToID])
                    if (replyRes.rows.length > 0) {
                        replyInfo = replyRes.rows[0];
                    }
                }

                const responeMessage = {
                    ...newMessage,
                    sender_name: senderResult.rows[0]?.username,
                    sender_avatar: senderResult.rows[0]?.avatar_url,
                    ...replyInfo
                }

                //update updated_at of conversation
                await pool.query(`
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = $1
                `, [conversationID]);

                // 1. Send message to everyone inside the conversation room
                io.to(`conversation:${conversationID}`).emit('receive_message', responeMessage);

                // 2. Also send message directly to online member sockets
                const membersResult = await pool.query(`
                    SELECT user_id FROM conversation_members WHERE conversation_id = $1
                `, [conversationID]);

                membersResult.rows.forEach(m => {
                    const memberSocketID = onlineUser.get(String(m.user_id));
                    if (memberSocketID) {
                        io.to(memberSocketID).emit('receive_message', responeMessage);
                    }
                });
            } catch (err) {
                console.error(err.message);
                socket.emit('message_error', 'Error when send message');
            }
        });

        //typing indicator
        socket.on('typing_start', (conversationID) => {
            socket.to(`conversation:${conversationID}`).emit(`typing_start`, {
                conversationID,
                userID,
                username: socket.user.username
            })
        });
        socket.on('typing_stop', (conversationID) => {
            socket.to(`conversation:${conversationID}`).emit('typing_stop', {
                conversationID,
                userID
            })
        });

        //user read
        socket.on('mark_as_read', (data) => {
            try {
                const { conversationID, lastReadMessageID } = data;
                socket.to(`conversation:${conversationID}`).emit('message_read', {
                    conversationID,
                    userID,
                    lastReadMessageID
                })
            } catch (err) {
                console.error('error mark_as_read socket: ', err.message);
            }
        })

        //edit message
        socket.on('edit_message', async (data) => {
            try {
                const { conversationID, messageID, newContent } = data;
                const result = await pool.query(`
                    UPDATE messages
                    SET content = $1, edited_at = NOW()
                    WHERE id = $2 AND sender_id = $3
                    RETURNING id, content, edited_at
                `, [newContent, messageID, userID]);
                if (result.rows.length === 0) {
                    return
                }
                const updated = result.rows[0];
                io.to(`conversation:${conversationID}`).emit('message_edited', {
                    messageID,
                    conversationID,
                    newContent: updated.content,
                    editedAt: updated.edited_at
                })
            } catch (err) {
                console.error(err.message);
            }
        })

        //delete message
        socket.on('delete_message', async (data) => {
            try {
                const { conversationID, messageID } = data;
                const result = await pool.query(`
                    UPDATE messages
                    SET deleted_at = NOW()
                    WHERE id = $1 AND sender_id = $2
                    RETURNING id, deleted_at
                `, [messageID, userID])
                if (result.rows.length === 0) return
                io.to(`conversation:${conversationID}`).emit('message_deleted', {
                    messageID,
                    conversationID,
                    deletedAt: result.rows[0].deleted_at
                })
            } catch (err) {
                console.error('error delete_message socket: ', err.message);
            }
        })

        //remove member
        socket.on('remove_member', (data) => {
            try {
                const { conversationID, targetUserID } = data;
                io.to(`conversation:${conversationID}`).emit('member_removed', {
                    conversationID,
                    targetUserID,
                });
                const targetSocketID = onlineUser.get(String(targetUserID));
                if (targetSocketID) {
                    io.to(targetSocketID).emit('you_were_removed', { conversationID });
                }
            } catch (err) {
                console.error('error remove_member socket: ', err.message);
            }
        });

        //leave conversation
        socket.on('leave_conversation', (data) => {
            try {
                const { conversationID } = data;
                io.to(`conversation:${conversationID}`).emit('user_left', { conversationID, userID });
                socket.leave(`conversation:${conversationID}`);
                console.log(`User ${userID} left room conversation: ${conversationID}`);
            } catch (err) {
                console.error('error leave_conversation socket: ', err.message);
            }
        })

        //add member to conversation
        socket.on('add_member', async (data) => {
            try {
                const { conversationID, targetIDs } = data;
                io.to(`conversation:${conversationID}`).emit('members_added', { conversationID, targetIDs });
                const result = await pool.query(`
                    SELECT id, name AS group_name, type, avatar_url AS group_avatar
                    FROM conversations
                    WHERE id = $1
                `, [conversationID]);
                if (result.rows.length > 0 && Array.isArray(targetIDs)) {
                    const conv = result.rows[0];
                    targetIDs.forEach(tID => {
                        const targetSocketID = onlineUser.get(String(tID));
                        if (targetSocketID) {
                            io.to(targetSocketID).emit('new_conversation', conv);
                        }
                    })
                }
            } catch (err) {
                console.error('error add_member socket: ', err.message)
            }
        })

        //update group profile
        socket.on('update_group_profile', (data) => {
            const { conversationID, group_name, group_avatar } = data;
            io.to(`conversation:${conversationID}`).emit('group_profile_updated', { conversationID, group_name, group_avatar });
        })

        //pin message
        socket.on('update_pinned_list', ({ conversationID, pinnedList }) => {
            io.to(`conversation:${conversationID}`).emit('pinned_list_updated', { conversationID, pinnedList });
        })

        //user disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnect: ${userID}`);
            onlineUser.delete(strUserID);
            io.emit('user_offline', strUserID);
        })
    });
}