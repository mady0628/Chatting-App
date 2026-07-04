import express from 'express'
import {authMiddleware} from "../middleware/auth.middleware.js"
import { createConversation, creatGroupConversation } from "../controller/conversation.controller.js"
const router = express.Router();

router.post('/direct', authMiddleware, createConversation)
router.post('/group', authMiddleware, creatGroupConversation)

export default router;