// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        const dbPath = path.join(__dirname, 'chatbot.db');
        console.log(`Attempting to open database at: ${dbPath}`);
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Failed to connect to database:', err);
            } else {
                console.log('Connected to SQLite database');
                this.init();
            }
        });
    }

    init() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                text TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Failed to create table:', err);
            } else {
                console.log('Messages table ready');
            }
        });
    }

    async saveMessage(userId, sender, text) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)',
                [userId, sender, text],
                (err) => {
                    if (err) {
                        console.error('Failed to save message:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getHistory(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT sender, text FROM messages WHERE user_id = ? ORDER BY timestamp ASC',
                [userId],
                (err, rows) => {
                    if (err) {
                        console.error('Failed to fetch history:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async clearHistory(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM messages WHERE user_id = ?',
                [userId],
                (err) => {
                    if (err) {
                        console.error('Failed to clear history:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    close() {
        this.db.close((err) => {
            if (err) console.error('Error closing database:', err);
            else console.log('Database connection closed');
        });
    }
}

module.exports = { Database };