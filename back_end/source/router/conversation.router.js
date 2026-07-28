import express from 'express'
import { authMiddleware } from "../middleware/auth.middleware.js"
import upload from '../middleware/multer.js';
import { createConversation, creatGroupConversation, getConversationMembers, getListConversations, getMessages, markAsRead, editMessage, deleteMessage, removeMember, leaveGroup, addMemberToConversation, uploadFile, updateGroupProfile, getPinnedMessage, pinMessage, unpinMessage } from "../controller/conversation.controller.js"
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
export default router;