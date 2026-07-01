import pool from '../db/pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); //lấy file name hiện tại
const __dirname = path.dirname(__filename); // lấy path hiện tại

const initDb = async () => {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql') // tạo path của file sql
        const sql = fs.readFileSync(schemaPath, 'utf-8'); // đọc file sql
        console.log("connecting");
        await pool.query(sql) // thực thi sql
        console.log("connect finish")
    } catch (err) {
        console.error("Error: ", err);
        process.exit();
    } finally {
        await pool.end();
    }
}

initDb()
