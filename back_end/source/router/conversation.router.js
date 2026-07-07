import express from 'express'
import { authMiddleware } from "../middleware/auth.middleware.js"
import { createConversation, creatGroupConversation, getListConversations, getMessages } from "../controller/conversation.controller.js"
const router = express.Router();

router.post('/direct', authMiddleware, createConversation)
router.post('/group', authMiddleware, creatGroupConversation)
router.get('/get-all', authMiddleware, getListConversations)
router.get('/:conversationID/messages', authMiddleware, getMessages)

export default router;