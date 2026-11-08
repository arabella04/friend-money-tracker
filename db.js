const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Supports Railway MySQL variables (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE),
// standard DB_* env variables, or local XAMPP MySQL defaults (localhost:3306, root, "", friend_money_tracker)
const DB_CONFIG = {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '', // default XAMPP MySQL password is blank
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'friend_money_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const CONNECTION_URI = process.env.MYSQL_URL || process.env.DATABASE_URL || null;

const db = CONNECTION_URI ? mysql.createPool(CONNECTION_URI) : mysql.createPool(DB_CONFIG);

const WALLET_NAMES = ['GCash', 'Maya', 'GoTyme', 'MariBank', 'Cash'];
const FALLBACK_FILE = path.join(__dirname, 'data', 'fallback-store.json');

let pool = db;
let mode = 'initializing'; // 'mysql' | 'fallback'
let lastMysqlError = null;

function formatLocalDate(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function createSampleSeedData() {
  const todayDay = new Date().getDate();
  const dueIn2Days = ((todayDay + 1) % 28) + 1; // 2 days ahead safely within 1..28
  const dueIn1Day = (todayDay % 28) + 1;
  const dueLater = ((todayDay + 12) % 28) + 1;

  const defaultPassHash = await bcrypt.hash('barkada123', 10);

  return {
    users: [
      { id: 1, nickname: 'miguel', password_hash: defaultPassHash, avatar_color: '#10b981', created_at: new Date().toISOString() },
      { id: 2, nickname: 'bea', password_hash: defaultPassHash, avatar_color: '#6366f1', created_at: new Date().toISOString() },
      { id: 3, nickname: 'jules', password_hash: defaultPassHash, avatar_color: '#f59e0b', created_at: new Date().toISOString() }
    ],
    wallets: [
      // Miguel's Wallets
      { id: 1, user_id: 1, wallet_name: 'GCash', balance: 8450.00, visibility: 'public', updated_at: new Date().toISOString() },
      { id: 2, user_id: 1, wallet_name: 'Maya', balance: 14200.50, visibility: 'public', updated_at: new Date().toISOString() },
      { id: 3, user_id: 1, wallet_name: 'GoTyme', balance: 32500.00, visibility: 'private', updated_at: new Date().toISOString() },
      { id: 4, user_id: 1, wallet_name: 'MariBank', balance: 19800.00, visibility: 'private', updated_at: new Date().toISOString() },
      { id: 5, user_id: 1, wallet_name: 'Cash', balance: 2350.00, visibility: 'public', updated_at: new Date().toISOString() },
      // Bea's Wallets
      { id: 6, user_id: 2, wallet_name: 'GCash', balance: 6120.00, visibility: 'public', updated_at: new Date().toISOString() },
      { id: 7, user_id: 2, wallet_name: 'Maya', balance: 9500.00, visibility: 'public', updated_at: new Date().toISOString() },
      { id: 8, user_id: 2, wallet_name: 'GoTyme', balance: 22000.00, visibility: 'private', updated_at: new Date().toISOString() },
      { id: 9, user_id: 2, wallet_name: 'MariBank', balance: 11400.00, visibility: 'private', updated_at: new Date().toISOString() },
      { id: 10, user_id: 2, wallet_name: 'Cash', balance: 1800.00, visibility: 'public', updated_at: new Date().toISOString() },
      // Jules's Wallets
      { id: 11, user_id: 3, wallet_name: 'GCash', balance: 4300.00, visibility: 'public', updated_at: new Date().toISOString() },
      { id: 12, user_id: 3, wallet_name: 'Maya', balance: 5100.00, visibility: 'private', updated_at: new Date().toISOString() },
      { id: 13, user_id: 3, wallet_name: 'GoTyme', balance: 15000.00, visibility: 'private', updated_at: new Date().toISOString() },
      { id: 14, user_id: 3, wallet_name: 'MariBank', balance: 8750.00, visibility: 'public', updated_at: new Date().toISOString() },
      { id: 15, user_id: 3, wallet_name: 'Cash', balance: 950.00, visibility: 'public', updated_at: new Date().toISOString() }
    ],
    transactions: [
      { id: 1, user_id: 1, wallet_id: 1, wallet_name: 'GCash', title: 'Valorant Reaver Vandal Bundle VP', amount: 1490.00, category: 'Gaming Spends', platform_tag: 'Valorant', visibility: 'public', tx_date: formatLocalDate(-6), created_at: new Date().toISOString() },
      { id: 2, user_id: 1, wallet_id: 2, wallet_name: 'Maya', title: 'Mechanical Keycaps & Coiled Cable', amount: 1280.00, category: 'Online Shopping', platform_tag: 'Shopee', visibility: 'public', tx_date: formatLocalDate(-5), created_at: new Date().toISOString() },
      { id: 3, user_id: 1, wallet_id: 5, wallet_name: 'Cash', title: 'Samgyupsal Barkada Dinner', amount: 899.00, category: 'Food & Dining', platform_tag: 'General', visibility: 'public', tx_date: formatLocalDate(-4), created_at: new Date().toISOString() },
      { id: 4, user_id: 1, wallet_id: 1, wallet_name: 'GCash', title: 'Angkas Rush Hour Ride to BGC', amount: 185.00, category: 'Commute / Transport', platform_tag: 'Angkas', visibility: 'public', tx_date: formatLocalDate(-3), created_at: new Date().toISOString() },
      { id: 5, user_id: 1, wallet_id: 3, wallet_name: 'GoTyme', title: 'Steam Autumn Sale (Hades II + Balatro)', amount: 1150.00, category: 'Gaming Spends', platform_tag: 'Steam', visibility: 'private', tx_date: formatLocalDate(-2), created_at: new Date().toISOString() },
      { id: 6, user_id: 1, wallet_id: 1, wallet_name: 'GCash', title: 'TikTok Shop Desk Mat & Monitor Lightbar', amount: 945.00, category: 'Online Shopping', platform_tag: 'TikTok', visibility: 'public', tx_date: formatLocalDate(-1), created_at: new Date().toISOString() },
      { id: 7, user_id: 1, wallet_id: 2, wallet_name: 'Maya', title: 'GrabFood Iced Spanish Latte & Croissant', amount: 340.00, category: 'Food & Dining', platform_tag: 'Grab', visibility: 'public', tx_date: formatLocalDate(0), created_at: new Date().toISOString() },
      { id: 8, user_id: 1, wallet_id: 1, wallet_name: 'GCash', title: 'Mobile Legends Weekly Diamond Pass + Skin', amount: 550.00, category: 'Gaming Spends', platform_tag: 'Mobile Legends', visibility: 'public', tx_date: formatLocalDate(0), created_at: new Date().toISOString() },
      { id: 9, user_id: 2, wallet_id: 6, wallet_name: 'GCash', title: 'Lazada 11.11 Skincare Restock', amount: 1640.00, category: 'Online Shopping', platform_tag: 'Lazada', visibility: 'public', tx_date: formatLocalDate(-2), created_at: new Date().toISOString() },
      { id: 10, user_id: 2, wallet_id: 7, wallet_name: 'Maya', title: 'Roblox 800 Robux Top-up', amount: 499.00, category: 'Gaming Spends', platform_tag: 'Roblox', visibility: 'public', tx_date: formatLocalDate(-1), created_at: new Date().toISOString() },
      { id: 11, user_id: 3, wallet_id: 11, wallet_name: 'GCash', title: 'CODM Battle Pass & Mythic Draw', amount: 820.00, category: 'Gaming Spends', platform_tag: 'CODM', visibility: 'public', tx_date: formatLocalDate(-1), created_at: new Date().toISOString() },
      { id: 12, user_id: 3, wallet_id: 15, wallet_name: 'Cash', title: 'LRT-2 Stored Value Card & Jeep Fare', amount: 140.00, category: 'Commute / Transport', platform_tag: 'LRT/MRT', visibility: 'public', tx_date: formatLocalDate(0), created_at: new Date().toISOString() }
    ],
    loans: [
      { id: 1, user_id: 1, item_name: 'TikTok Hall-Effect Keyboard', platform: 'TikTok PayLater', total_price: 3600.00, monthly_due: 600.00, term_months: 6, months_paid: 2, due_day: dueIn2Days, visibility: 'public', last_paid_at: null, created_at: new Date().toISOString() },
      { id: 2, user_id: 1, item_name: 'Sony WH-1000XM5 Headphones', platform: 'SPayLater', total_price: 15000.00, monthly_due: 2500.00, term_months: 6, months_paid: 4, due_day: dueIn1Day, visibility: 'private', last_paid_at: null, created_at: new Date().toISOString() },
      { id: 3, user_id: 1, item_name: '27" 180Hz IPS Gaming Monitor', platform: 'LazPayLater', total_price: 9600.00, monthly_due: 1600.00, term_months: 6, months_paid: 3, due_day: dueLater, visibility: 'public', last_paid_at: null, created_at: new Date().toISOString() },
      { id: 4, user_id: 2, item_name: 'Kindle Paperwhite 16GB', platform: 'Billease', total_price: 7200.00, monthly_due: 1200.00, term_months: 6, months_paid: 5, due_day: dueIn2Days, visibility: 'public', last_paid_at: null, created_at: new Date().toISOString() },
      { id: 5, user_id: 3, item_name: 'Logitech G Pro X Superlight 2', platform: 'GCredit', total_price: 6900.00, monthly_due: 2300.00, term_months: 3, months_paid: 1, due_day: dueLater, visibility: 'public', last_paid_at: null, created_at: new Date().toISOString() }
    ],
    savings_goals: [
      { id: 1, user_id: 1, title: 'Barkada Siargao / El Nido Trip', storage_bank: 'GoTyme GoSave', interest_rate: 4.00, target_amount: 25000.00, current_amount: 14500.00, target_date: formatLocalDate(75), visibility: 'public', created_at: new Date().toISOString() },
      { id: 2, user_id: 1, title: '6-Month Emergency Buffer Fund', storage_bank: 'MariBank', interest_rate: 4.50, target_amount: 60000.00, current_amount: 32500.00, target_date: formatLocalDate(180), visibility: 'private', created_at: new Date().toISOString() },
      { id: 3, user_id: 1, title: 'RTX 5070 Gaming PC Upgrade', storage_bank: 'Maya Savings', interest_rate: 6.00, target_amount: 38000.00, current_amount: 19800.00, target_date: formatLocalDate(120), visibility: 'public', created_at: new Date().toISOString() },
      { id: 4, user_id: 2, title: '2NE1 / K-Pop VIP Concert Ticket Fund', storage_bank: 'GoTyme GoSave', interest_rate: 4.00, target_amount: 18000.00, current_amount: 15200.00, target_date: formatLocalDate(45), visibility: 'public', created_at: new Date().toISOString() },
      { id: 5, user_id: 3, title: 'New iPad Air M3 Sinking Fund', storage_bank: 'MariBank', interest_rate: 4.50, target_amount: 42000.00, current_amount: 16800.00, target_date: formatLocalDate(90), visibility: 'public', created_at: new Date().toISOString() }
    ]
  };
}

// Ensure fallback JSON file exists
async function loadFallbackStore() {
  const dir = path.dirname(FALLBACK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FALLBACK_FILE)) {
    const seed = await createSampleSeedData();
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8'));
    if (!parsed.savings_goals) {
      const seed = await createSampleSeedData();
      parsed.savings_goals = seed.savings_goals;
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    }
    return parsed;
  } catch (err) {
    const seed = await createSampleSeedData();
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
}

function saveFallbackStore(store) {
  const dir = path.dirname(FALLBACK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(store, null, 2), 'utf8');
}

async function initDatabase() {
  try {
    if (CONNECTION_URI) {
      // Railway / Cloud MySQL URI already points to a created database
      pool = mysql.createPool(CONNECTION_URI);
    } else {
      // 1. Connect without database first to create `friend_money_tracker` if needed
      const bootstrapConn = await mysql.createConnection({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password
      });

      await bootstrapConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await bootstrapConn.end();

      // 2. Create pool connected to `friend_money_tracker`
      pool = mysql.createPool(DB_CONFIG);
    }

    // 3. Create tables if not existing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        avatar_color VARCHAR(20) DEFAULT '#10b981',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        wallet_name ENUM('GCash', 'Maya', 'GoTyme', 'MariBank', 'Cash') NOT NULL,
        balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        visibility ENUM('private', 'public') NOT NULL DEFAULT 'private',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_wallet (user_id, wallet_name),
        CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        wallet_id INT NULL,
        wallet_name VARCHAR(30) NOT NULL,
        title VARCHAR(120) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        category ENUM(
          'Food & Dining',
          'Commute / Transport',
          'Online Shopping',
          'Gaming Spends',
          'Bills & Others',
          'Adjustment'
        ) NOT NULL,
        platform_tag VARCHAR(50) DEFAULT 'General',
        visibility ENUM('private', 'public') NOT NULL DEFAULT 'public',
        tx_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_name VARCHAR(120) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
        monthly_due DECIMAL(12, 2) NOT NULL,
        term_months INT NOT NULL,
        months_paid INT NOT NULL DEFAULT 0,
        due_day INT NOT NULL,
        visibility ENUM('private', 'public') NOT NULL DEFAULT 'public',
        last_paid_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(120) NOT NULL,
        storage_bank VARCHAR(50) NOT NULL DEFAULT 'GoTyme GoSave',
        interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 4.00,
        target_amount DECIMAL(12, 2) NOT NULL,
        current_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        target_date DATE NULL,
        visibility ENUM('private', 'public') NOT NULL DEFAULT 'public',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_savings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 4. Seed initial sample friends & transactions if empty
    const [existingUsers] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
    if (existingUsers[0].cnt === 0) {
      const seed = await createSampleSeedData();
      for (const u of seed.users) {
        await pool.query(
          'INSERT INTO users (id, nickname, password_hash, avatar_color) VALUES (?, ?, ?, ?)',
          [u.id, u.nickname, u.password_hash, u.avatar_color]
        );
      }
      for (const w of seed.wallets) {
        await pool.query(
          'INSERT INTO wallets (id, user_id, wallet_name, balance, visibility) VALUES (?, ?, ?, ?, ?)',
          [w.id, w.user_id, w.wallet_name, w.balance, w.visibility]
        );
      }
      for (const t of seed.transactions) {
        await pool.query(
          'INSERT INTO transactions (id, user_id, wallet_id, wallet_name, title, amount, category, platform_tag, visibility, tx_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [t.id, t.user_id, t.wallet_id, t.wallet_name, t.title, t.amount, t.category, t.platform_tag, t.visibility, t.tx_date]
        );
      }
      for (const l of seed.loans) {
        await pool.query(
          'INSERT INTO loans (id, user_id, item_name, platform, total_price, monthly_due, term_months, months_paid, due_day, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [l.id, l.user_id, l.item_name, l.platform, l.total_price, l.monthly_due, l.term_months, l.months_paid, l.due_day, l.visibility]
        );
      }
      for (const s of seed.savings_goals) {
        await pool.query(
          'INSERT INTO savings_goals (id, user_id, title, storage_bank, interest_rate, target_amount, current_amount, target_date, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [s.id, s.user_id, s.title, s.storage_bank, s.interest_rate, s.target_amount, s.current_amount, s.target_date, s.visibility]
        );
      }
    }

    mode = 'mysql';
    lastMysqlError = null;
    console.log(`[DB] Connected to XAMPP MySQL/MariaDB (${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database})`);
    return { mode, config: { host: DB_CONFIG.host, port: DB_CONFIG.port, database: DB_CONFIG.database, user: DB_CONFIG.user } };
  } catch (err) {
    mode = 'fallback';
    lastMysqlError = err.message || 'Unable to reach XAMPP MySQL on localhost:3306';
    await loadFallbackStore();
    console.warn(`[DB] XAMPP MySQL not reachable (${lastMysqlError}). Running with local persistent store until XAMPP MySQL is started.`);
    return { mode, error: lastMysqlError, config: { host: DB_CONFIG.host, port: DB_CONFIG.port, database: DB_CONFIG.database, user: DB_CONFIG.user } };
  }
}

function getStatus() {
  return {
    mode,
    database: DB_CONFIG.database,
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    lastMysqlError
  };
}

// Repository API that seamlessly works on both MySQL (XAMPP) and Fallback Store
const repo = {
  async findUserByNickname(nickname) {
    const clean = nickname.trim().toLowerCase();
    if (mode === 'mysql') {
      const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(nickname) = ? LIMIT 1', [clean]);
      return rows[0] || null;
    }
    const store = await loadFallbackStore();
    return store.users.find(u => u.nickname.toLowerCase() === clean) || null;
  },

  async findUserById(id) {
    if (mode === 'mysql') {
      const [rows] = await pool.query('SELECT id, nickname, avatar_color, created_at FROM users WHERE id = ? LIMIT 1', [id]);
      return rows[0] || null;
    }
    const store = await loadFallbackStore();
    const u = store.users.find(x => x.id === Number(id));
    if (!u) return null;
    return { id: u.id, nickname: u.nickname, avatar_color: u.avatar_color, created_at: u.created_at };
  },

  async createUser(nickname, passwordHash, avatarColor) {
    const clean = nickname.trim().toLowerCase();
    if (mode === 'mysql') {
      const [res] = await pool.query(
        'INSERT INTO users (nickname, password_hash, avatar_color) VALUES (?, ?, ?)',
        [clean, passwordHash, avatarColor]
      );
      const userId = res.insertId;
      for (const wName of WALLET_NAMES) {
        const defaultVis = ['GCash', 'Maya', 'Cash'].includes(wName) ? 'public' : 'private';
        await pool.query(
          'INSERT INTO wallets (user_id, wallet_name, balance, visibility) VALUES (?, ?, 0.00, ?)',
          [userId, wName, defaultVis]
        );
      }
      return this.findUserById(userId);
    }

    const store = await loadFallbackStore();
    const nextUserId = store.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
    const newUser = {
      id: nextUserId,
      nickname: clean,
      password_hash: passwordHash,
      avatar_color: avatarColor,
      created_at: new Date().toISOString()
    };
    store.users.push(newUser);

    let nextWalletId = store.wallets.reduce((m, w) => Math.max(m, w.id), 0) + 1;
    for (const wName of WALLET_NAMES) {
      const defaultVis = ['GCash', 'Maya', 'Cash'].includes(wName) ? 'public' : 'private';
      store.wallets.push({
        id: nextWalletId++,
        user_id: nextUserId,
        wallet_name: wName,
        balance: 0.00,
        visibility: defaultVis,
        updated_at: new Date().toISOString()
      });
    }
    saveFallbackStore(store);
    return { id: newUser.id, nickname: newUser.nickname, avatar_color: newUser.avatar_color, created_at: newUser.created_at };
  },

  async getWalletsByUser(userId) {
    if (mode === 'mysql') {
      const [rows] = await pool.query(
        `SELECT id, user_id, wallet_name, CAST(balance AS DECIMAL(12,2)) AS balance, visibility, updated_at
         FROM wallets WHERE user_id = ?
         ORDER BY FIELD(wallet_name, 'GCash', 'Maya', 'GoTyme', 'MariBank', 'Cash')`,
        [userId]
      );
      return rows.map(r => ({ ...r, balance: Number(r.balance) }));
    }
    const store = await loadFallbackStore();
    const order = WALLET_NAMES;
    return store.wallets
      .filter(w => w.user_id === Number(userId))
      .sort((a, b) => order.indexOf(a.wallet_name) - order.indexOf(b.wallet_name))
      .map(w => ({ ...w, balance: Number(w.balance) }));
  },

  async updateWallet(userId, walletId, { balance, adjustmentDelta, visibility, reason }) {
    if (mode === 'mysql') {
      const [rows] = await pool.query('SELECT * FROM wallets WHERE id = ? AND user_id = ?', [walletId, userId]);
      if (!rows.length) return null;
      const current = rows[0];
      let newBalance = Number(current.balance);
      if (typeof balance === 'number' && !Number.isNaN(balance)) {
        newBalance = balance;
      } else if (typeof adjustmentDelta === 'number' && !Number.isNaN(adjustmentDelta)) {
        newBalance = Number((newBalance + adjustmentDelta).toFixed(2));
      }
      const newVis = visibility || current.visibility;
      await pool.query(
        'UPDATE wallets SET balance = ?, visibility = ? WHERE id = ? AND user_id = ?',
        [newBalance, newVis, walletId, userId]
      );
      if (reason && Math.abs(newBalance - Number(current.balance)) > 0.001) {
        const diff = Math.abs(newBalance - Number(current.balance));
        await pool.query(
          `INSERT INTO transactions (user_id, wallet_id, wallet_name, title, amount, category, platform_tag, visibility, tx_date)
           VALUES (?, ?, ?, ?, ?, 'Adjustment', 'Manual Sync', ?, CURDATE())`,
          [userId, walletId, current.wallet_name, reason, diff, newVis]
        );
      }
      const [updated] = await pool.query('SELECT * FROM wallets WHERE id = ?', [walletId]);
      return { ...updated[0], balance: Number(updated[0].balance) };
    }

    const store = await loadFallbackStore();
    const wallet = store.wallets.find(w => w.id === Number(walletId) && w.user_id === Number(userId));
    if (!wallet) return null;
    const prevBal = Number(wallet.balance);
    if (typeof balance === 'number' && !Number.isNaN(balance)) {
      wallet.balance = Number(balance.toFixed(2));
    } else if (typeof adjustmentDelta === 'number' && !Number.isNaN(adjustmentDelta)) {
      wallet.balance = Number((prevBal + adjustmentDelta).toFixed(2));
    }
    if (visibility) wallet.visibility = visibility;
    wallet.updated_at = new Date().toISOString();

    if (reason && Math.abs(wallet.balance - prevBal) > 0.001) {
      const nextTxId = store.transactions.reduce((m, t) => Math.max(m, t.id), 0) + 1;
      store.transactions.push({
        id: nextTxId,
        user_id: Number(userId),
        wallet_id: wallet.id,
        wallet_name: wallet.wallet_name,
        title: reason,
        amount: Number(Math.abs(wallet.balance - prevBal).toFixed(2)),
        category: 'Adjustment',
        platform_tag: 'Manual Sync',
        visibility: wallet.visibility,
        tx_date: formatLocalDate(0),
        created_at: new Date().toISOString()
      });
    }
    saveFallbackStore(store);
    return { ...wallet, balance: Number(wallet.balance) };
  },

  async toggleWalletVisibility(userId, walletId, visibility) {
    return this.updateWallet(userId, walletId, { visibility });
  },

  async createTransaction(userId, payload) {
    const {
      title,
      amount,
      category,
      platform_tag = 'General',
      wallet_name = 'GCash',
      visibility = 'public',
      tx_date = formatLocalDate(0),
      deduct_from_wallet = true
    } = payload;

    const numAmount = Number(Number(amount).toFixed(2));

    if (mode === 'mysql') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [wRows] = await conn.query(
          'SELECT * FROM wallets WHERE user_id = ? AND wallet_name = ? LIMIT 1',
          [userId, wallet_name]
        );
        const wallet = wRows[0] || null;
        if (wallet && deduct_from_wallet) {
          await conn.query(
            'UPDATE wallets SET balance = balance - ? WHERE id = ?',
            [numAmount, wallet.id]
          );
        }
        const [ins] = await conn.query(
          `INSERT INTO transactions (user_id, wallet_id, wallet_name, title, amount, category, platform_tag, visibility, tx_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, wallet ? wallet.id : null, wallet_name, title.trim(), numAmount, category, platform_tag, visibility, tx_date]
        );
        await conn.commit();
        const [rows] = await pool.query(
          `SELECT t.*, u.nickname, u.avatar_color
           FROM transactions t
           JOIN users u ON u.id = t.user_id
           WHERE t.id = ?`,
          [ins.insertId]
        );
        return { ...rows[0], amount: Number(rows[0].amount) };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const store = await loadFallbackStore();
    const wallet = store.wallets.find(w => w.user_id === Number(userId) && w.wallet_name === wallet_name);
    if (wallet && deduct_from_wallet) {
      wallet.balance = Number((Number(wallet.balance) - numAmount).toFixed(2));
      wallet.updated_at = new Date().toISOString();
    }
    const nextId = store.transactions.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    const user = store.users.find(u => u.id === Number(userId));
    const tx = {
      id: nextId,
      user_id: Number(userId),
      wallet_id: wallet ? wallet.id : null,
      wallet_name,
      title: title.trim(),
      amount: numAmount,
      category,
      platform_tag,
      visibility,
      tx_date,
      created_at: new Date().toISOString()
    };
    store.transactions.push(tx);
    saveFallbackStore(store);
    return {
      ...tx,
      nickname: user ? user.nickname : 'friend',
      avatar_color: user ? user.avatar_color : '#10b981'
    };
  },

  async toggleTransactionVisibility(userId, txId, visibility) {
    if (mode === 'mysql') {
      await pool.query(
        'UPDATE transactions SET visibility = ? WHERE id = ? AND user_id = ?',
        [visibility, txId, userId]
      );
      const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
      return rows[0] ? { ...rows[0], amount: Number(rows[0].amount) } : null;
    }
    const store = await loadFallbackStore();
    const tx = store.transactions.find(t => t.id === Number(txId) && t.user_id === Number(userId));
    if (!tx) return null;
    tx.visibility = visibility;
    saveFallbackStore(store);
    return { ...tx, amount: Number(tx.amount) };
  },

  async deleteTransaction(userId, txId) {
    if (mode === 'mysql') {
      const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
      if (!rows.length) return false;
      const tx = rows[0];
      if (tx.wallet_id && tx.category !== 'Adjustment') {
        await pool.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [tx.amount, tx.wallet_id]);
      }
      await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
      return true;
    }
    const store = await loadFallbackStore();
    const idx = store.transactions.findIndex(t => t.id === Number(txId) && t.user_id === Number(userId));
    if (idx === -1) return false;
    const tx = store.transactions[idx];
    if (tx.wallet_id && tx.category !== 'Adjustment') {
      const wallet = store.wallets.find(w => w.id === tx.wallet_id);
      if (wallet) wallet.balance = Number((Number(wallet.balance) + Number(tx.amount)).toFixed(2));
    }
    store.transactions.splice(idx, 1);
    saveFallbackStore(store);
    return true;
  },

  async getTransactionsByUser(userId) {
    if (mode === 'mysql') {
      const [rows] = await pool.query(
        `SELECT t.*, DATE_FORMAT(t.tx_date, '%Y-%m-%d') AS tx_date_str, u.nickname, u.avatar_color
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         WHERE t.user_id = ?
         ORDER BY t.tx_date DESC, t.id DESC`,
        [userId]
      );
      return rows.map(r => ({
        ...r,
        tx_date: r.tx_date_str || r.tx_date,
        amount: Number(r.amount)
      }));
    }
    const store = await loadFallbackStore();
    const user = store.users.find(u => u.id === Number(userId));
    return store.transactions
      .filter(t => t.user_id === Number(userId))
      .sort((a, b) => (b.tx_date.localeCompare(a.tx_date) || b.id - a.id))
      .map(t => ({
        ...t,
        amount: Number(t.amount),
        nickname: user ? user.nickname : 'user',
        avatar_color: user ? user.avatar_color : '#10b981'
      }));
  },

  async createLoan(userId, payload) {
    const {
      item_name,
      platform,
      total_price,
      monthly_due,
      term_months,
      months_paid = 0,
      due_day,
      visibility = 'public'
    } = payload;

    if (mode === 'mysql') {
      const [ins] = await pool.query(
        `INSERT INTO loans (user_id, item_name, platform, total_price, monthly_due, term_months, months_paid, due_day, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          item_name.trim(),
          platform,
          Number(total_price),
          Number(monthly_due),
          Number(term_months),
          Number(months_paid),
          Number(due_day),
          visibility
        ]
      );
      const [rows] = await pool.query(
        `SELECT l.*, u.nickname, u.avatar_color
         FROM loans l JOIN users u ON u.id = l.user_id
         WHERE l.id = ?`,
        [ins.insertId]
      );
      return {
        ...rows[0],
        total_price: Number(rows[0].total_price),
        monthly_due: Number(rows[0].monthly_due)
      };
    }

    const store = await loadFallbackStore();
    const nextId = store.loans.reduce((m, l) => Math.max(m, l.id), 0) + 1;
    const user = store.users.find(u => u.id === Number(userId));
    const loan = {
      id: nextId,
      user_id: Number(userId),
      item_name: item_name.trim(),
      platform,
      total_price: Number(Number(total_price).toFixed(2)),
      monthly_due: Number(Number(monthly_due).toFixed(2)),
      term_months: Number(term_months),
      months_paid: Number(months_paid),
      due_day: Number(due_day),
      visibility,
      last_paid_at: null,
      created_at: new Date().toISOString()
    };
    store.loans.push(loan);
    saveFallbackStore(store);
    return {
      ...loan,
      nickname: user ? user.nickname : 'user',
      avatar_color: user ? user.avatar_color : '#10b981'
    };
  },

  async getLoansByUser(userId) {
    if (mode === 'mysql') {
      const [rows] = await pool.query(
        `SELECT l.*, u.nickname, u.avatar_color
         FROM loans l
         JOIN users u ON u.id = l.user_id
         WHERE l.user_id = ?
         ORDER BY (l.months_paid >= l.term_months) ASC, l.due_day ASC, l.id DESC`,
        [userId]
      );
      return rows.map(r => ({
        ...r,
        total_price: Number(r.total_price),
        monthly_due: Number(r.monthly_due),
        term_months: Number(r.term_months),
        months_paid: Number(r.months_paid),
        due_day: Number(r.due_day)
      }));
    }
    const store = await loadFallbackStore();
    const user = store.users.find(u => u.id === Number(userId));
    return store.loans
      .filter(l => l.user_id === Number(userId))
      .sort((a, b) => {
        const aDone = a.months_paid >= a.term_months ? 1 : 0;
        const bDone = b.months_paid >= b.term_months ? 1 : 0;
        return aDone - bDone || a.due_day - b.due_day || b.id - a.id;
      })
      .map(l => ({
        ...l,
        total_price: Number(l.total_price),
        monthly_due: Number(l.monthly_due),
        term_months: Number(l.term_months),
        months_paid: Number(l.months_paid),
        due_day: Number(l.due_day),
        nickname: user ? user.nickname : 'user',
        avatar_color: user ? user.avatar_color : '#10b981'
      }));
  },

  async payLoanInstallment(userId, loanId, walletName) {
    if (mode === 'mysql') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [lRows] = await conn.query('SELECT * FROM loans WHERE id = ? AND user_id = ? FOR UPDATE', [loanId, userId]);
        if (!lRows.length) throw new Error('Installment plan not found');
        const loan = lRows[0];
        if (loan.months_paid >= loan.term_months) {
          throw new Error('This installment is already fully paid!');
        }

        const newMonthsPaid = Number(loan.months_paid) + 1;
        await conn.query(
          'UPDATE loans SET months_paid = ?, last_paid_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newMonthsPaid, loan.id]
        );

        const [wRows] = await conn.query(
          'SELECT * FROM wallets WHERE user_id = ? AND wallet_name = ? LIMIT 1',
          [userId, walletName]
        );
        const wallet = wRows[0] || null;
        if (wallet) {
          await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [loan.monthly_due, wallet.id]);
        }

        // Also record a transaction for the installment payment
        const txTitle = `${loan.item_name} (${loan.platform} • Month ${newMonthsPaid}/${loan.term_months})`;
        await conn.query(
          `INSERT INTO transactions (user_id, wallet_id, wallet_name, title, amount, category, platform_tag, visibility, tx_date)
           VALUES (?, ?, ?, ?, ?, 'Bills & Others', ?, ?, CURDATE())`,
          [userId, wallet ? wallet.id : null, walletName, txTitle, loan.monthly_due, loan.platform, loan.visibility]
        );

        await conn.commit();
        const [updated] = await pool.query('SELECT * FROM loans WHERE id = ?', [loan.id]);
        return {
          ...updated[0],
          total_price: Number(updated[0].total_price),
          monthly_due: Number(updated[0].monthly_due),
          term_months: Number(updated[0].term_months),
          months_paid: Number(updated[0].months_paid),
          due_day: Number(updated[0].due_day)
        };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const store = await loadFallbackStore();
    const loan = store.loans.find(l => l.id === Number(loanId) && l.user_id === Number(userId));
    if (!loan) throw new Error('Installment plan not found');
    if (loan.months_paid >= loan.term_months) {
      throw new Error('This installment is already fully paid!');
    }

    loan.months_paid += 1;
    loan.last_paid_at = new Date().toISOString();

    const wallet = store.wallets.find(w => w.user_id === Number(userId) && w.wallet_name === walletName);
    if (wallet) {
      wallet.balance = Number((Number(wallet.balance) - Number(loan.monthly_due)).toFixed(2));
      wallet.updated_at = new Date().toISOString();
    }

    const nextTxId = store.transactions.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    store.transactions.push({
      id: nextTxId,
      user_id: Number(userId),
      wallet_id: wallet ? wallet.id : null,
      wallet_name: walletName,
      title: `${loan.item_name} (${loan.platform} • Month ${loan.months_paid}/${loan.term_months})`,
      amount: Number(loan.monthly_due),
      category: 'Bills & Others',
      platform_tag: loan.platform,
      visibility: loan.visibility,
      tx_date: formatLocalDate(0),
      created_at: new Date().toISOString()
    });

    saveFallbackStore(store);
    return { ...loan };
  },

  async toggleLoanVisibility(userId, loanId, visibility) {
    if (mode === 'mysql') {
      await pool.query('UPDATE loans SET visibility = ? WHERE id = ? AND user_id = ?', [visibility, loanId, userId]);
      const [rows] = await pool.query('SELECT * FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
      return rows[0] || null;
    }
    const store = await loadFallbackStore();
    const loan = store.loans.find(l => l.id === Number(loanId) && l.user_id === Number(userId));
    if (!loan) return null;
    loan.visibility = visibility;
    saveFallbackStore(store);
    return { ...loan };
  },

  async deleteLoan(userId, loanId) {
    if (mode === 'mysql') {
      const [res] = await pool.query('DELETE FROM loans WHERE id = ? AND user_id = ?', [loanId, userId]);
      return res.affectedRows > 0;
    }
    const store = await loadFallbackStore();
    const idx = store.loans.findIndex(l => l.id === Number(loanId) && l.user_id === Number(userId));
    if (idx === -1) return false;
    store.loans.splice(idx, 1);
    saveFallbackStore(store);
    return true;
  },

  async getSavingsByUser(userId) {
    if (mode === 'mysql') {
      const [rows] = await pool.query(
        `SELECT s.*, DATE_FORMAT(s.target_date, '%Y-%m-%d') AS target_date_str, u.nickname, u.avatar_color
         FROM savings_goals s
         JOIN users u ON u.id = s.user_id
         WHERE s.user_id = ?
         ORDER BY (s.current_amount >= s.target_amount) ASC, s.id DESC`,
        [userId]
      );
      return rows.map(r => ({
        ...r,
        target_date: r.target_date_str || r.target_date,
        interest_rate: Number(r.interest_rate),
        target_amount: Number(r.target_amount),
        current_amount: Number(r.current_amount)
      }));
    }
    const store = await loadFallbackStore();
    const user = store.users.find(u => u.id === Number(userId));
    return (store.savings_goals || [])
      .filter(s => s.user_id === Number(userId))
      .sort((a, b) => {
        const aDone = a.current_amount >= a.target_amount ? 1 : 0;
        const bDone = b.current_amount >= b.target_amount ? 1 : 0;
        return aDone - bDone || b.id - a.id;
      })
      .map(s => ({
        ...s,
        interest_rate: Number(s.interest_rate),
        target_amount: Number(s.target_amount),
        current_amount: Number(s.current_amount),
        nickname: user ? user.nickname : 'user',
        avatar_color: user ? user.avatar_color : '#10b981'
      }));
  },

  async createSavingsGoal(userId, payload) {
    const {
      title,
      storage_bank = 'GoTyme GoSave',
      interest_rate = 4.00,
      target_amount,
      current_amount = 0,
      target_date = null,
      visibility = 'public'
    } = payload;

    if (mode === 'mysql') {
      const [ins] = await pool.query(
        `INSERT INTO savings_goals (user_id, title, storage_bank, interest_rate, target_amount, current_amount, target_date, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          title.trim(),
          storage_bank,
          Number(interest_rate),
          Number(target_amount),
          Number(current_amount || 0),
          target_date || null,
          visibility
        ]
      );
      const [rows] = await pool.query(
        `SELECT s.*, DATE_FORMAT(s.target_date, '%Y-%m-%d') AS target_date_str, u.nickname, u.avatar_color
         FROM savings_goals s JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`,
        [ins.insertId]
      );
      return {
        ...rows[0],
        target_date: rows[0].target_date_str || rows[0].target_date,
        interest_rate: Number(rows[0].interest_rate),
        target_amount: Number(rows[0].target_amount),
        current_amount: Number(rows[0].current_amount)
      };
    }

    const store = await loadFallbackStore();
    if (!store.savings_goals) store.savings_goals = [];
    const nextId = store.savings_goals.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const user = store.users.find(u => u.id === Number(userId));
    const goal = {
      id: nextId,
      user_id: Number(userId),
      title: title.trim(),
      storage_bank,
      interest_rate: Number(Number(interest_rate).toFixed(2)),
      target_amount: Number(Number(target_amount).toFixed(2)),
      current_amount: Number(Number(current_amount || 0).toFixed(2)),
      target_date: target_date || null,
      visibility,
      created_at: new Date().toISOString()
    };
    store.savings_goals.push(goal);
    saveFallbackStore(store);
    return {
      ...goal,
      nickname: user ? user.nickname : 'user',
      avatar_color: user ? user.avatar_color : '#10b981'
    };
  },

  async contributeToSavingsGoal(userId, goalId, { amount, source_wallet, deduct_wallet }) {
    const numAmount = Number(Number(amount).toFixed(2));
    if (mode === 'mysql') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [gRows] = await conn.query('SELECT * FROM savings_goals WHERE id = ? AND user_id = ? FOR UPDATE', [goalId, userId]);
        if (!gRows.length) throw new Error('Savings goal not found');
        const goal = gRows[0];
        const newCurrent = Number((Number(goal.current_amount) + numAmount).toFixed(2));

        await conn.query('UPDATE savings_goals SET current_amount = ? WHERE id = ?', [newCurrent, goal.id]);

        if (deduct_wallet && source_wallet) {
          const [wRows] = await conn.query(
            'SELECT * FROM wallets WHERE user_id = ? AND wallet_name = ? LIMIT 1',
            [userId, source_wallet]
          );
          if (wRows.length) {
            await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [numAmount, wRows[0].id]);
          }
        }
        await conn.commit();
        const [updated] = await pool.query('SELECT * FROM savings_goals WHERE id = ?', [goal.id]);
        return {
          ...updated[0],
          interest_rate: Number(updated[0].interest_rate),
          target_amount: Number(updated[0].target_amount),
          current_amount: Number(updated[0].current_amount)
        };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const store = await loadFallbackStore();
    const goal = (store.savings_goals || []).find(s => s.id === Number(goalId) && s.user_id === Number(userId));
    if (!goal) throw new Error('Savings goal not found');
    goal.current_amount = Number((Number(goal.current_amount) + numAmount).toFixed(2));

    if (deduct_wallet && source_wallet) {
      const wallet = store.wallets.find(w => w.user_id === Number(userId) && w.wallet_name === source_wallet);
      if (wallet) {
        wallet.balance = Number((Number(wallet.balance) - numAmount).toFixed(2));
        wallet.updated_at = new Date().toISOString();
      }
    }
    saveFallbackStore(store);
    return { ...goal };
  },

  async toggleSavingsVisibility(userId, goalId, visibility) {
    if (mode === 'mysql') {
      await pool.query('UPDATE savings_goals SET visibility = ? WHERE id = ? AND user_id = ?', [visibility, goalId, userId]);
      const [rows] = await pool.query('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
      return rows[0] || null;
    }
    const store = await loadFallbackStore();
    const goal = (store.savings_goals || []).find(s => s.id === Number(goalId) && s.user_id === Number(userId));
    if (!goal) return null;
    goal.visibility = visibility;
    saveFallbackStore(store);
    return { ...goal };
  },

  async deleteSavingsGoal(userId, goalId) {
    if (mode === 'mysql') {
      const [res] = await pool.query('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [goalId, userId]);
      return res.affectedRows > 0;
    }
    const store = await loadFallbackStore();
    if (!store.savings_goals) return false;
    const idx = store.savings_goals.findIndex(s => s.id === Number(goalId) && s.user_id === Number(userId));
    if (idx === -1) return false;
    store.savings_goals.splice(idx, 1);
    saveFallbackStore(store);
    return true;
  },

  async getSharedFeed() {
    if (mode === 'mysql') {
      const [txRows] = await pool.query(
        `SELECT t.*, DATE_FORMAT(t.tx_date, '%Y-%m-%d') AS tx_date_str, u.nickname, u.avatar_color
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         WHERE t.visibility = 'public'
         ORDER BY t.tx_date DESC, t.id DESC
         LIMIT 60`
      );
      const [loanRows] = await pool.query(
        `SELECT l.*, u.nickname, u.avatar_color
         FROM loans l
         JOIN users u ON u.id = l.user_id
         WHERE l.visibility = 'public'
         ORDER BY l.id DESC`
      );
      const [savingsRows] = await pool.query(
        `SELECT s.*, DATE_FORMAT(s.target_date, '%Y-%m-%d') AS target_date_str, u.nickname, u.avatar_color
         FROM savings_goals s
         JOIN users u ON u.id = s.user_id
         WHERE s.visibility = 'public'
         ORDER BY s.id DESC`
      );
      const [walletRows] = await pool.query(
        `SELECT w.*, u.nickname, u.avatar_color
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE w.visibility = 'public'
         ORDER BY u.nickname ASC, FIELD(w.wallet_name, 'GCash', 'Maya', 'GoTyme', 'MariBank', 'Cash')`
      );
      const [usersRows] = await pool.query(
        `SELECT id, nickname, avatar_color, created_at FROM users ORDER BY id ASC`
      );

      return {
        transactions: txRows.map(r => ({ ...r, tx_date: r.tx_date_str || r.tx_date, amount: Number(r.amount) })),
        loans: loanRows.map(r => ({
          ...r,
          total_price: Number(r.total_price),
          monthly_due: Number(r.monthly_due),
          term_months: Number(r.term_months),
          months_paid: Number(r.months_paid),
          due_day: Number(r.due_day)
        })),
        savings: savingsRows.map(r => ({
          ...r,
          target_date: r.target_date_str || r.target_date,
          interest_rate: Number(r.interest_rate),
          target_amount: Number(r.target_amount),
          current_amount: Number(r.current_amount)
        })),
        wallets: walletRows.map(r => ({ ...r, balance: Number(r.balance) })),
        friends: usersRows
      };
    }

    const store = await loadFallbackStore();
    const userMap = new Map(store.users.map(u => [u.id, u]));

    const transactions = store.transactions
      .filter(t => t.visibility === 'public')
      .sort((a, b) => (b.tx_date.localeCompare(a.tx_date) || b.id - a.id))
      .slice(0, 60)
      .map(t => {
        const u = userMap.get(t.user_id);
        return {
          ...t,
          amount: Number(t.amount),
          nickname: u ? u.nickname : 'friend',
          avatar_color: u ? u.avatar_color : '#10b981'
        };
      });

    const loans = store.loans
      .filter(l => l.visibility === 'public')
      .sort((a, b) => b.id - a.id)
      .map(l => {
        const u = userMap.get(l.user_id);
        return {
          ...l,
          total_price: Number(l.total_price),
          monthly_due: Number(l.monthly_due),
          term_months: Number(l.term_months),
          months_paid: Number(l.months_paid),
          due_day: Number(l.due_day),
          nickname: u ? u.nickname : 'friend',
          avatar_color: u ? u.avatar_color : '#10b981'
        };
      });

    const savings = (store.savings_goals || [])
      .filter(s => s.visibility === 'public')
      .sort((a, b) => b.id - a.id)
      .map(s => {
        const u = userMap.get(s.user_id);
        return {
          ...s,
          interest_rate: Number(s.interest_rate),
          target_amount: Number(s.target_amount),
          current_amount: Number(s.current_amount),
          nickname: u ? u.nickname : 'friend',
          avatar_color: u ? u.avatar_color : '#10b981'
        };
      });

    const wallets = store.wallets
      .filter(w => w.visibility === 'public')
      .map(w => {
        const u = userMap.get(w.user_id);
        return {
          ...w,
          balance: Number(w.balance),
          nickname: u ? u.nickname : 'friend',
          avatar_color: u ? u.avatar_color : '#10b981'
        };
      });

    const friends = store.users.map(u => ({
      id: u.id,
      nickname: u.nickname,
      avatar_color: u.avatar_color,
      created_at: u.created_at
    }));

    return { transactions, loans, savings, wallets, friends };
  }
};

module.exports = {
  db,
  initDatabase,
  getStatus,
  repo,
  WALLET_NAMES
};
