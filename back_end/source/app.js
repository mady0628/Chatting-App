import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import morgan from 'morgan'
import pool from './db/pool.js'
import authRouter from './router/auth.router.js'

dotenv.config()

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server run at ${PORT}`)
})