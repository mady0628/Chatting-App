import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireSystemAdmin } from '../middleware/admin.middleware.js';
import {
    getSystemStats,
    getAllUsers,
    toggleBanUser,
    changeSystemRole,
    getAllConversations,
    getAdminConversationMessages
} from '../controller/admin.controller.js';

const router = express.Router();

// Apply Auth & System Admin protection to all admin endpoints
router.use(authMiddleware, requireSystemAdmin);

router.get('/stats', getSystemStats);
router.get('/users', getAllUsers);
router.patch('/users/:targetUserID/ban', toggleBanUser);
router.patch('/users/:targetUserID/role', changeSystemRole);
router.get('/conversations', getAllConversations);
router.get('/conversations/:conversationID/messages', getAdminConversationMessages);

export default router;
