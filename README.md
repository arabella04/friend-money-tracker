# BarkadaVault — Friends Money, Expense & BNPL Tracker (PH)

A full-stack, mobile-responsive **Money & Expense Tracker** built with **HTML5, Tailwind CSS, Vanilla JavaScript, Chart.js, Node.js (Express), and MySQL / MariaDB (XAMPP)**.

## Quick Start

1. **Open XAMPP Control Panel** and start **MySQL** (`localhost:3306`, user: `root`, password: `""`, database: `friend_money_tracker`).
   - *Note:* On startup, the backend automatically runs `CREATE DATABASE IF NOT EXISTS friend_money_tracker`, creates all required tables (`users`, `wallets`, `transactions`, `loans`), and seeds sample Barkada accounts (`@miguel`, `@bea`, `@jules` — password: `barkada123`).
   - You can also import `schema.sql` manually in phpMyAdmin if preferred.
   - If XAMPP MySQL is temporarily stopped, the server gracefully falls back to `data/fallback-store.json` and lets you click the **DB badge** in the top header to reconnect to XAMPP MySQL at any time.

2. **Start the Server**:
   ```bash
   cd C:\Users\arabe\.gemini\antigravity\scratch\friend-money-tracker
   npm start
   ```

3. **Open in Browser**:
   Visit `http://localhost:3000`
