import express from 'express';
import { sign_in, sign_up } from '../controller/auth.controller.js';

const router = express.Router();

router.post('/sign-up', sign_up);
router.post('/sign-in', sign_in);

export default router;