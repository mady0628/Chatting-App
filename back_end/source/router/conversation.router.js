import express from 'express'
import { authMiddleware } from "../middleware/auth.middleware.js"
import upload from '../middleware/multer.js';
import { createConversation, creatGroupConversation, getConversationMembers, getListConversations, getMessages, markAsRead, editMessage, deleteMessage, removeMember, leaveGroup, addMemberToConversation, uploadFile, updateGroupProfile, getPinnedMessage, pinMessage, unpinMessage, toggleReaction, searchMessage, getMessagesContext, getMessagesBefore, getMessagesAfter, getConversationImages, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, cancelFriendRequest, getListFriend, getListFriendRequest } from "../controller/conversation.controller.js"
const router = express.Router();

router.post('/direct', authMiddleware, createConversation)
router.post('/group', authMiddleware, creatGroupConversation)
router.get('/get-all', authMiddleware, getListConversations)
router.get('/:conversationID/messages', authMiddleware, getMessages)
router.get('/:conversationID/members', authMiddleware, getConversationMembers)
router.patch('/:conversationID/mark-read', authMiddleware, markAsRead)
router.patch('/:messageID/edit', authMiddleware, editMessage)
router.patch('/:messageID/delete', authMiddleware, deleteMessage)
router.delete('/:conversationID/remove-member/:targetUserID', authMiddleware, removeMember)
router.delete('/:conversationID/leave', authMiddleware, leaveGroup)
router.post('/:conversationID/add-member', authMiddleware, addMemberToConversation)
router.post('/upload', authMiddleware, upload.single('file'), uploadFile)
router.put('/group/:conversationID/update-profile', authMiddleware, updateGroupProfile)
router.post('/:conversationID/pin/:messageID', authMiddleware, pinMessage)
router.delete('/:conversationID/unpin/:messageID', authMiddleware, unpinMessage)
router.get('/:conversationID/pinned-messages', authMiddleware, getPinnedMessage)
router.post('/:conversationID/messages/:messageID/react', authMiddleware, toggleReaction)
router.get('/:conversationID/messages/search', authMiddleware, searchMessage)
router.get('/:conversationID/messages/before', authMiddleware, getMessagesBefore)
router.get('/:conversationID/messages/after', authMiddleware, getMessagesAfter)
router.get('/:conversationID/images', authMiddleware, getConversationImages)
router.get('/:conversationID/messages/:messageID/context', authMiddleware, getMessagesContext)
router.post('/friend-request', authMiddleware, sendFriendRequest);
router.post('/friend-request/accept', authMiddleware, acceptFriendRequest);
router.post('/friend-request/reject', authMiddleware, rejectFriendRequest);
router.delete('/friend/remove/:friendID', authMiddleware, removeFriend);
router.delete('/friend-request/cancel/:requestID', authMiddleware, cancelFriendRequest)
router.get('/friend/get-all', authMiddleware, getListFriend)
router.get('/friend-request/get-all', authMiddleware, getListFriendRequest)
export default router;