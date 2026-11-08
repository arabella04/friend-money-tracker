const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDatabase, getStatus, repo, WALLET_NAMES } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'friend-money-tracker-jwt-secret-key-2026';

const AVATAR_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f43f5e'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Calculate days until due day of month (1-31)
function computeDueInfo(dueDay, monthsPaid, termMonths) {
  const isCompleted = Number(monthsPaid) >= Number(termMonths);
  if (isCompleted) {
    return {
      is_completed: true,
      days_until_due: null,
      is_due_soon: false,
      due_status_text: 'Fully Paid'
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const clampDay = (year, month, day) => {
    const maxDay = new Date(year, month + 1, 0).getDate();
    return Math.min(day, maxDay);
  };

  let targetYear = today.getFullYear();
  let targetMonth = today.getMonth();
  let candidateDay = clampDay(targetYear, targetMonth, Number(dueDay));
  let nextDueDate = new Date(targetYear, targetMonth, candidateDay);

  if (nextDueDate < today) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    candidateDay = clampDay(targetYear, targetMonth, Number(dueDay));
    nextDueDate = new Date(targetYear, targetMonth, candidateDay);
  }

  const diffTime = nextDueDate.getTime() - today.getTime();
  const daysUntilDue = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3;

  let dueStatusText = `Due in ${daysUntilDue} days`;
  if (daysUntilDue === 0) dueStatusText = 'Due TODAY';
  else if (daysUntilDue === 1) dueStatusText = 'Due in 1 day';

  return {
    is_completed: false,
    days_until_due: daysUntilDue,
    is_due_soon: isDueSoon,
    next_due_date: nextDueDate.toISOString().split('T')[0],
    due_status_text: dueStatusText
  };
}

function enrichLoan(loan) {
  const paidAmount = Number((Number(loan.months_paid) * Number(loan.monthly_due)).toFixed(2));
  const totalPrice = Number(loan.total_price);
  const progressPct = totalPrice > 0
    ? Math.min(100, Math.round((Number(loan.months_paid) / Number(loan.term_months)) * 100))
    : 0;
  const dueInfo = computeDueInfo(loan.due_day, loan.months_paid, loan.term_months);

  return {
    ...loan,
    paid_amount: paidAmount,
    remaining_amount: Math.max(0, Number((totalPrice - paidAmount).toFixed(2))),
    progress_pct: progressPct,
    ...dueInfo
  };
}

function enrichSavingsGoal(goal) {
  const current = Number(goal.current_amount || 0);
  const target = Number(goal.target_amount || 1);
  const rate = Number(goal.interest_rate || 0);
  const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  // PH Digital Banks typically withhold 20% final tax on interest
  const estAnnualInterestNet = Number((current * (rate / 100) * 0.8).toFixed(2));
  const estMonthlyInterestNet = Number((estAnnualInterestNet / 12).toFixed(2));

  return {
    ...goal,
    progress_pct: progressPct,
    remaining_to_goal: Math.max(0, Number((target - current).toFixed(2))),
    is_completed: current >= target,
    est_annual_interest: estAnnualInterestNet,
    est_monthly_interest: estMonthlyInterestNet
  };
}

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token. Please log in again.' });
    }
    req.user = payload;
    next();
  });
}

// --- SYSTEM & DB ROUTES ---
app.get('/api/system/status', (req, res) => {
  res.json(getStatus());
});

app.post('/api/system/reconnect', async (req, res) => {
  const status = await initDatabase();
  res.json(status);
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    if (!nickname || !password) {
      return res.status(400).json({ error: 'Nickname and password are required.' });
    }
    const cleanNick = nickname.trim().toLowerCase();
    if (cleanNick.length < 2 || cleanNick.length > 30) {
      return res.status(400).json({ error: 'Nickname must be between 2 and 30 characters.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    const existing = await repo.findUserByNickname(cleanNick);
    if (existing) {
      return res.status(409).json({ error: `Nickname "@${cleanNick}" is already taken.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const user = await repo.createUser(cleanNick, passwordHash, avatarColor);

    const token = jwt.sign(
      { id: user.id, nickname: user.nickname, avatar_color: user.avatar_color },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created and 5 wallets initialized!',
      token,
      user
    });
  } catch (err) {
    console.error('[AUTH REGISTER ERROR]', err);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    if (!nickname || !password) {
      return res.status(400).json({ error: 'Nickname and password are required.' });
    }

    const userRecord = await repo.findUserByNickname(nickname);
    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid nickname or password.' });
    }

    const match = await bcrypt.compare(password, userRecord.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid nickname or password.' });
    }

    const user = {
      id: userRecord.id,
      nickname: userRecord.nickname,
      avatar_color: userRecord.avatar_color,
      created_at: userRecord.created_at
    };

    const token = jwt.sign(
      { id: user.id, nickname: user.nickname, avatar_color: user.avatar_color },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: `Welcome back, @${user.nickname}!`,
      token,
      user
    });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await repo.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session profile.' });
  }
});

// --- WALLETS ROUTES ---
app.get('/api/wallets', authenticateToken, async (req, res) => {
  try {
    const wallets = await repo.getWalletsByUser(req.user.id);
    const totalNetWorth = Number(
      wallets.reduce((sum, w) => sum + Number(w.balance), 0).toFixed(2)
    );
    const publicNetWorth = Number(
      wallets.filter(w => w.visibility === 'public').reduce((sum, w) => sum + Number(w.balance), 0).toFixed(2)
    );
    res.json({
      wallets,
      total_net_worth: totalNetWorth,
      public_net_worth: publicNetWorth
    });
  } catch (err) {
    console.error('[GET WALLETS ERROR]', err);
    res.status(500).json({ error: 'Failed to load wallets.' });
  }
});

app.put('/api/wallets/:id', authenticateToken, async (req, res) => {
  try {
    const walletId = Number(req.params.id);
    const { balance, adjustment_delta, visibility, reason } = req.body;

    const updated = await repo.updateWallet(req.user.id, walletId, {
      balance: balance !== undefined ? Number(balance) : undefined,
      adjustmentDelta: adjustment_delta !== undefined ? Number(adjustment_delta) : undefined,
      visibility,
      reason
    });

    if (!updated) {
      return res.status(404).json({ error: 'Wallet not found.' });
    }

    res.json({ wallet: updated });
  } catch (err) {
    console.error('[UPDATE WALLET ERROR]', err);
    res.status(500).json({ error: 'Failed to update wallet.' });
  }
});

app.patch('/api/wallets/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const walletId = Number(req.params.id);
    const { visibility } = req.body;
    if (!['private', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibility must be "private" or "public".' });
    }
    const updated = await repo.toggleWalletVisibility(req.user.id, walletId, visibility);
    if (!updated) return res.status(404).json({ error: 'Wallet not found.' });
    res.json({ wallet: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle wallet visibility.' });
  }
});

// --- TRANSACTIONS / EXPENSES ROUTES ---
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await repo.getTransactionsByUser(req.user.id);
    res.json({ transactions });
  } catch (err) {
    console.error('[GET TRANSACTIONS ERROR]', err);
    res.status(500).json({ error: 'Failed to load transactions.' });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      amount,
      category,
      platform_tag,
      wallet_name,
      visibility,
      tx_date,
      deduct_from_wallet
    } = req.body;

    if (!title || amount === undefined || Number(amount) <= 0 || !category || !wallet_name) {
      return res.status(400).json({ error: 'Please provide title, positive amount, category, and source wallet.' });
    }

    const tx = await repo.createTransaction(req.user.id, {
      title,
      amount: Number(amount),
      category,
      platform_tag: platform_tag || 'General',
      wallet_name,
      visibility: visibility === 'private' ? 'private' : 'public',
      tx_date,
      deduct_from_wallet: deduct_from_wallet !== false
    });

    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error('[CREATE TRANSACTION ERROR]', err);
    res.status(500).json({ error: 'Failed to log expense.' });
  }
});

app.patch('/api/transactions/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const txId = Number(req.params.id);
    const { visibility } = req.body;
    if (!['private', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibility must be "private" or "public".' });
    }
    const updated = await repo.toggleTransactionVisibility(req.user.id, txId, visibility);
    if (!updated) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ transaction: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction visibility.' });
  }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const txId = Number(req.params.id);
    const deleted = await repo.deleteTransaction(req.user.id, txId);
    if (!deleted) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

// --- BNPL & LOAN INSTALLMENTS ROUTES ---
app.get('/api/loans', authenticateToken, async (req, res) => {
  try {
    const rawLoans = await repo.getLoansByUser(req.user.id);
    const loans = rawLoans.map(enrichLoan);
    const dueAlerts = loans.filter(l => l.is_due_soon && !l.is_completed);
    res.json({ loans, due_alerts: dueAlerts });
  } catch (err) {
    console.error('[GET LOANS ERROR]', err);
    res.status(500).json({ error: 'Failed to load installment plans.' });
  }
});

app.post('/api/loans', authenticateToken, async (req, res) => {
  try {
    const {
      item_name,
      platform,
      total_price,
      monthly_due,
      term_months,
      months_paid = 0,
      due_day,
      visibility = 'public'
    } = req.body;

    if (!item_name || !platform || !total_price || !monthly_due || !term_months || !due_day) {
      return res.status(400).json({ error: 'All BNPL / installment fields are required.' });
    }

    const dueDayNum = Number(due_day);
    if (dueDayNum < 1 || dueDayNum > 31) {
      return res.status(400).json({ error: 'Due day of the month must be between 1 and 31.' });
    }

    const created = await repo.createLoan(req.user.id, {
      item_name,
      platform,
      total_price: Number(total_price),
      monthly_due: Number(monthly_due),
      term_months: Number(term_months),
      months_paid: Number(months_paid || 0),
      due_day: dueDayNum,
      visibility: visibility === 'private' ? 'private' : 'public'
    });

    res.status(201).json({ loan: enrichLoan(created) });
  } catch (err) {
    console.error('[CREATE LOAN ERROR]', err);
    res.status(500).json({ error: 'Failed to create BNPL installment.' });
  }
});

app.post('/api/loans/:id/pay', authenticateToken, async (req, res) => {
  try {
    const loanId = Number(req.params.id);
    const { wallet_name = 'GCash' } = req.body;
    if (!WALLET_NAMES.includes(wallet_name)) {
      return res.status(400).json({ error: 'Invalid wallet selected for payment.' });
    }
    const updated = await repo.payLoanInstallment(req.user.id, loanId, wallet_name);
    res.json({
      message: `Marked month ${updated.months_paid}/${updated.term_months} as paid via ${wallet_name}!`,
      loan: enrichLoan(updated)
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to record installment payment.' });
  }
});

app.patch('/api/loans/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const loanId = Number(req.params.id);
    const { visibility } = req.body;
    if (!['private', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibility must be "private" or "public".' });
    }
    const updated = await repo.toggleLoanVisibility(req.user.id, loanId, visibility);
    if (!updated) return res.status(404).json({ error: 'Installment not found.' });
    res.json({ loan: enrichLoan(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update loan visibility.' });
  }
});

app.delete('/api/loans/:id', authenticateToken, async (req, res) => {
  try {
    const loanId = Number(req.params.id);
    const deleted = await repo.deleteLoan(req.user.id, loanId);
    if (!deleted) return res.status(404).json({ error: 'Installment not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete installment.' });
  }
});

// --- SAVINGS GOALS / ALKANSYA ROUTES ---
app.get('/api/savings', authenticateToken, async (req, res) => {
  try {
    const rawGoals = await repo.getSavingsByUser(req.user.id);
    const goals = rawGoals.map(enrichSavingsGoal);
    const totalSaved = Number(goals.reduce((s, g) => s + Number(g.current_amount), 0).toFixed(2));
    const totalTarget = Number(goals.reduce((s, g) => s + Number(g.target_amount), 0).toFixed(2));
    const totalAnnualInterest = Number(goals.reduce((s, g) => s + Number(g.est_annual_interest), 0).toFixed(2));
    res.json({
      savings: goals,
      total_saved: totalSaved,
      total_target: totalTarget,
      total_annual_interest: totalAnnualInterest
    });
  } catch (err) {
    console.error('[GET SAVINGS ERROR]', err);
    res.status(500).json({ error: 'Failed to load savings goals.' });
  }
});

app.post('/api/savings', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      storage_bank = 'GoTyme GoSave',
      interest_rate = 4.0,
      target_amount,
      current_amount = 0,
      target_date = null,
      visibility = 'public'
    } = req.body;

    if (!title || !target_amount || Number(target_amount) <= 0) {
      return res.status(400).json({ error: 'Please provide a goal title and a positive target amount.' });
    }

    const created = await repo.createSavingsGoal(req.user.id, {
      title,
      storage_bank,
      interest_rate: Number(interest_rate || 0),
      target_amount: Number(target_amount),
      current_amount: Number(current_amount || 0),
      target_date: target_date || null,
      visibility: visibility === 'private' ? 'private' : 'public'
    });

    res.status(201).json({ goal: enrichSavingsGoal(created) });
  } catch (err) {
    console.error('[CREATE SAVINGS ERROR]', err);
    res.status(500).json({ error: 'Failed to create savings goal.' });
  }
});

app.post('/api/savings/:id/contribute', authenticateToken, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { amount, source_wallet = 'GoTyme', deduct_wallet = false } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Please enter a valid deposit amount.' });
    }
    const updated = await repo.contributeToSavingsGoal(req.user.id, goalId, {
      amount: Number(amount),
      source_wallet,
      deduct_wallet: Boolean(deduct_wallet)
    });
    res.json({
      message: `Added ₱${Number(amount).toLocaleString()} to "${updated.title}"!`,
      goal: enrichSavingsGoal(updated)
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to add funds to savings goal.' });
  }
});

app.patch('/api/savings/:id/visibility', authenticateToken, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const { visibility } = req.body;
    if (!['private', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibility must be "private" or "public".' });
    }
    const updated = await repo.toggleSavingsVisibility(req.user.id, goalId, visibility);
    if (!updated) return res.status(404).json({ error: 'Savings goal not found.' });
    res.json({ goal: enrichSavingsGoal(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle savings visibility.' });
  }
});

app.delete('/api/savings/:id', authenticateToken, async (req, res) => {
  try {
    const goalId = Number(req.params.id);
    const deleted = await repo.deleteSavingsGoal(req.user.id, goalId);
    if (!deleted) return res.status(404).json({ error: 'Savings goal not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete savings goal.' });
  }
});

// --- SHARED SOCIAL FEED ROUTE ---
app.get('/api/feed', authenticateToken, async (req, res) => {
  try {
    const feed = await repo.getSharedFeed();
    res.json({
      transactions: feed.transactions,
      loans: feed.loans.map(enrichLoan),
      savings: (feed.savings || []).map(enrichSavingsGoal),
      wallets: feed.wallets,
      friends: feed.friends
    });
  } catch (err) {
    console.error('[GET FEED ERROR]', err);
    res.status(500).json({ error: 'Failed to load Shared Feed.' });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 BarkadaVault Money & Expense Tracker running at http://localhost:${PORT}`);
  });
});
