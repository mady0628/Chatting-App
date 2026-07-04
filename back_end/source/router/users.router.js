import express from 'express'
import {authMiddleware} from '../middleware/auth.middleware.js';
import { getUsers } from '../controller/users.controller.js';

const router = express.Router();

router.get('/search', authMiddleware, getUsers);

export default router;
