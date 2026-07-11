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
    io.on('connection', (socket) => {
        const userID = socket.user.id;
        console.log(`User connect: ${socket.user.username || userID}. UserID: ${userID}`);

        //user online
        onlineUser.set(userID, socket.id);
        io.emit('user_online', userID);

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
                const { conversationID, content, type = 'text' } = data;
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
                    INSERT INTO messages(conversation_id, sender_id, content, type)
                    VALUES ($1,$2,$3,$4)
                    RETURNING id, conversation_id, sender_id, content, type, created_at
                `, [conversationID, userID, content, type]);

                const newMessage = result.rows[0];

                const senderResult = await pool.query(`
                    SELECT username, avatar_url FROM users
                    WHERE id = $1`, [userID]);
                const responeMessage = {
                    ...newMessage,
                    sender: senderResult.rows[0],
                }

                //update updated_at of conversation
                await pool.query(`
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = $1
                `, [conversationID]);

                //send message to conversationD
                io.to(`conversation:${conversationID}`).emit('receive_message', responeMessage);

                //send res for user
                socket.emit('message_sent', responeMessage);
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

        //user disconnect
        socket.on('disconnect', () => {
            console.log(`User disconnect: ${userID}`);
            onlineUser.delete(userID);
            io.emit('user_offline', userID);
        })
    });
}