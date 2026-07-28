import express from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getUsers, updateProfile, changePassword } from '../controller/users.controller.js';
import upload from '../middleware/multer.js'

const router = express.Router();

router.get('/search', authMiddleware, getUsers);
router.put('/profile', authMiddleware, upload.single('avatar'), updateProfile);
router.patch('/password', authMiddleware, changePassword);

export default router;
