-- Friend Money & Expense Tracker — MySQL / MariaDB Schema (XAMPP)
-- Host: localhost | User: root | Password: "" | Database: friend_money_tracker

CREATE DATABASE IF NOT EXISTS friend_money_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE friend_money_tracker;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(20) DEFAULT '#10b981',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Wallets Table (GCash, Maya, GoTyme, MariBank, Cash)
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

-- 3. Transactions / Expenses Table
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

-- 4. BNPL & Loan Installments Table
CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  monthly_due DECIMAL(12, 2) NOT NULL,
  term_months INT NOT NULL,
  months_paid INT NOT NULL DEFAULT 0,
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  visibility ENUM('private', 'public') NOT NULL DEFAULT 'public',
  last_paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Savings Goals / Alkansya Table
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

