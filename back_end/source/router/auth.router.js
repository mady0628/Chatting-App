import express from 'express';
import { sign_in, sign_up, refresh_token, logout } from '../controller/auth.controller.js';

const router = express.Router();

router.post('/sign-up', sign_up);
router.post('/sign-in', sign_in);
router.post('/refresh', refresh_token);
router.post('/logout', logout);

export default router;