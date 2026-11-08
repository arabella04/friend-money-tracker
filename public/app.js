// ==============================================================
// BarkadaVault — Frontend Controller & Chart.js Visualizations
// ==============================================================

const state = {
  token: localStorage.getItem('bv_token') || null,
  user: JSON.parse(localStorage.getItem('bv_user') || 'null'),
  authMode: 'login',
  activeTab: 'vault', // 'vault' | 'feed'
  walletAdjustMode: 'exact', // 'exact' | 'delta'
  wallets: [],
  totalNetWorth: 0,
  publicNetWorth: 0,
  transactions: [],
  loans: [],
  dueAlerts: [],
  savings: [],
  savingsSummary: { total_saved: 0, total_target: 0, total_annual_interest: 0 },
  feed: {
    transactions: [],
    loans: [],
    savings: [],
    wallets: [],
    friends: []
  },
  selectedFeedFriend: 'ALL'
};

// Chart.js instances
let categoryChartInstance = null;
let platformChartInstance = null;
let trendChartInstance = null;

// Category -> Platform Presets
const CATEGORY_PLATFORMS = {
  'Food & Dining': ['Grab', 'Foodpanda', 'Dine-In / Resto', 'Coffee Shop', 'General'],
  'Commute / Transport': ['Jeep', 'Angkas', 'JoyRide', 'LRT/MRT', 'Grab'],
  'Online Shopping': ['Shopee', 'Lazada', 'TikTok', 'Grab'],
  'Gaming Spends': ['Valorant', 'Steam', 'Roblox', 'Mobile Legends', 'CODM'],
  'Bills & Others': ['Meralco / Utilities', 'Internet / Telco', 'TikTok PayLater', 'SPayLater', 'LazPayLater', 'Billease', 'GCredit', 'General']
};

const WALLET_META = {
  GCash: { badge: 'G', colorClass: 'wallet-gcash', pillBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', subtitle: 'E-Wallet • Instant QR/Send' },
  Maya: { badge: 'M', colorClass: 'wallet-maya', pillBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', subtitle: 'Digital Bank & Wallet' },
  GoTyme: { badge: 'GT', colorClass: 'wallet-gotyme', pillBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', subtitle: 'GoSave High-Yield Bank' },
  MariBank: { badge: 'MB', colorClass: 'wallet-maribank', pillBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40', subtitle: 'Daily Interest Savings' },
  Cash: { badge: '₱', colorClass: 'wallet-cash', pillBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', subtitle: 'Physical Bills & Coins' }
};

const CATEGORY_META = {
  'Food & Dining': { icon: '🍔', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  'Commute / Transport': { icon: '🛵', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  'Online Shopping': { icon: '🛍️', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  'Gaming Spends': { icon: '🎮', badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  'Bills & Others': { icon: '💡', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  Adjustment: { icon: '⚖️', badgeClass: 'bg-slate-700/60 text-slate-300 border-slate-600' }
};

// Format PHP Currency: ₱1,450.00
function formatPHP(val) {
  const num = Number(val || 0);
  return '₱' + num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  const colors = type === 'error'
    ? 'bg-rose-950/95 border-rose-700 text-rose-200'
    : 'bg-slate-900/95 border-emerald-500/60 text-emerald-200';
  el.className = `pointer-events-auto px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold flex items-center justify-between gap-3 transition-all ${colors}`;
  el.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white font-bold">✕</button>
  `;
  container.appendChild(el);
  setTimeout(() => {
    if (el.parentElement) el.remove();
  }, 3800);
}

// API Helper with JWT Authorization
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      handleLogout(false);
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// Check XAMPP MySQL / Fallback Status
async function checkSystemStatus() {
  try {
    const status = await apiFetch('/api/system/status');
    const authBadge = document.getElementById('auth-db-badge');
    const headerBadge = document.getElementById('header-db-badge');

    if (status.mode === 'mysql') {
      const label = `🟢 MySQL: ${status.database}`;
      if (authBadge) {
        authBadge.textContent = label;
        authBadge.className = 'text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60';
      }
      if (headerBadge) {
        headerBadge.textContent = label;
        headerBadge.className = 'text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60';
      }
    } else {
      const label = '⚡ Local DB (XAMPP Ready)';
      if (authBadge) {
        authBadge.textContent = label;
        authBadge.title = `Start XAMPP MySQL (${status.host}:${status.port}/${status.database}) and click to sync`;
      }
      if (headerBadge) {
        headerBadge.textContent = label;
        headerBadge.title = `XAMPP MySQL not running (${status.lastMysqlError || 'port 3306 offline'}). Using local persistent store — click to retry MySQL.`;
      }
    }
  } catch (e) {
    // ignore
  }
}

async function reconnectDatabase() {
  try {
    const res = await apiFetch('/api/system/reconnect', { method: 'POST' });
    await checkSystemStatus();
    if (res.mode === 'mysql') {
      showToast('Connected to XAMPP MySQL (friend_money_tracker)!', 'success');
      if (state.token) await refreshAllData();
    } else {
      showToast('XAMPP MySQL on localhost:3306 is not running yet — continuing on local persistent store.', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==============================================================
// AUTHENTICATION FLOW
// ==============================================================
function switchAuthMode(mode) {
  state.authMode = mode;
  const loginBtn = document.getElementById('tab-login-btn');
  const regBtn = document.getElementById('tab-register-btn');
  const submitBtn = document.getElementById('auth-submit-btn');
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  if (mode === 'login') {
    loginBtn.className = 'py-2 text-sm font-semibold rounded-lg transition bg-emerald-500 text-slate-950 shadow';
    regBtn.className = 'py-2 text-sm font-semibold rounded-lg transition text-slate-400 hover:text-white';
    submitBtn.textContent = 'Enter My Vault →';
  } else {
    regBtn.className = 'py-2 text-sm font-semibold rounded-lg transition bg-emerald-500 text-slate-950 shadow';
    loginBtn.className = 'py-2 text-sm font-semibold rounded-lg transition text-slate-400 hover:text-white';
    submitBtn.textContent = 'Create Account & Initialize 5 Wallets →';
  }
}

async function quickDemoLogin(nickname, password) {
  document.getElementById('auth-nickname').value = nickname;
  document.getElementById('auth-password').value = password;
  switchAuthMode('login');
  await submitAuth(nickname, password, 'login');
}

async function submitAuth(nickname, password, mode) {
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');
  try {
    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const data = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ nickname, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('bv_token', data.token);
    localStorage.setItem('bv_user', JSON.stringify(data.user));
    showToast(data.message || `Logged in as @${data.user.nickname}`);
    await enterAppView();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function handleLogout(notify = true) {
  state.token = null;
  state.user = null;
  localStorage.removeItem('bv_token');
  localStorage.removeItem('bv_user');
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('auth-view').classList.remove('hidden');
  if (notify) showToast('Logged out safely.');
}

async function enterAppView() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');

  if (state.user) {
    document.getElementById('user-nickname').textContent = `@${state.user.nickname}`;
    const avatar = document.getElementById('user-avatar');
    avatar.textContent = state.user.nickname.charAt(0).toUpperCase();
    avatar.style.backgroundColor = state.user.avatar_color || '#10b981';
  }

  await refreshAllData();
}

// ==============================================================
// DATA LOADING & SYNCHRONIZATION
// ==============================================================
async function refreshAllData() {
  try {
    const [walletRes, txRes, loanRes, savingsRes, feedRes] = await Promise.all([
      apiFetch('/api/wallets'),
      apiFetch('/api/transactions'),
      apiFetch('/api/loans'),
      apiFetch('/api/savings'),
      apiFetch('/api/feed')
    ]);

    state.wallets = walletRes.wallets || [];
    state.totalNetWorth = walletRes.total_net_worth || 0;
    state.publicNetWorth = walletRes.public_net_worth || 0;
    state.transactions = txRes.transactions || [];
    state.loans = loanRes.loans || [];
    state.dueAlerts = loanRes.due_alerts || [];
    state.savings = savingsRes.savings || [];
    state.savingsSummary = {
      total_saved: savingsRes.total_saved || 0,
      total_target: savingsRes.total_target || 0,
      total_annual_interest: savingsRes.total_annual_interest || 0
    };
    state.feed = feedRes;

    renderSummaryAndWallets();
    renderDueDateAlerts();
    renderLoans();
    renderSavingsTab();
    renderVaultTransactions();
    renderAnalyticsCharts();
    renderSharedFeed();
  } catch (err) {
    console.error('Failed to refresh data:', err);
  }
}

// ==============================================================
// RENDER 1: WALLETS & COMBINED NET WORTH
// ==============================================================
function renderSummaryAndWallets() {
  document.getElementById('header-net-worth').textContent = formatPHP(state.totalNetWorth);
  document.getElementById('vault-total-networth').textContent = formatPHP(state.totalNetWorth);
  document.getElementById('vault-public-networth').textContent = formatPHP(state.publicNetWorth);

  // Compute current month outflow (excluding manual Adjustments)
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthOutflow = state.transactions
    .filter(t => t.category !== 'Adjustment' && String(t.tx_date).startsWith(monthPrefix))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  document.getElementById('vault-month-outflow').textContent = formatPHP(monthOutflow);

  // Compute active monthly BNPL commitment
  const activeMonthlyBnpl = state.loans
    .filter(l => !l.is_completed)
    .reduce((sum, l) => sum + Number(l.monthly_due), 0);
  document.getElementById('vault-monthly-bnpl').textContent = `${formatPHP(activeMonthlyBnpl)}/mo`;

  // Render 5 Wallets Grid
  const grid = document.getElementById('wallets-grid');
  grid.innerHTML = state.wallets.map(w => {
    const meta = WALLET_META[w.wallet_name] || WALLET_META.Cash;
    const isPub = w.visibility === 'public';
    return `
      <div class="glass-card glass-card-hover ${meta.colorClass} rounded-2xl p-4 flex flex-col justify-between border">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl ${meta.pillBg} border flex items-center justify-center font-extrabold text-sm">
              ${meta.badge}
            </div>
            <div>
              <h3 class="text-sm font-extrabold text-white leading-tight">${escapeHtml(w.wallet_name)}</h3>
              <p class="text-[11px] text-slate-400">${meta.subtitle}</p>
            </div>
          </div>

          <!-- Privacy Toggle Button -->
          <button onclick="quickToggleWalletVisibility(${w.id}, '${isPub ? 'private' : 'public'}')"
            title="Click to toggle between Public (Friends) and Private (Only Me)"
            class="px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
              isPub
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
            }">
            ${isPub ? '🌐 Public' : '🔒 Private'}
          </button>
        </div>

        <div class="mt-4 flex items-end justify-between">
          <div>
            <span class="text-[10px] uppercase tracking-wider text-slate-400 block">Available Balance</span>
            <span class="text-xl font-extrabold text-white tracking-tight">${formatPHP(w.balance)}</span>
          </div>
          <button onclick="openWalletModal(${w.id})"
            class="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold transition">
            Adjust
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function quickToggleWalletVisibility(walletId, nextVisibility) {
  try {
    await apiFetch(`/api/wallets/${walletId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: nextVisibility })
    });
    showToast(`Wallet visibility set to ${nextVisibility === 'public' ? 'Public (Friends)' : 'Private (Only Me)'}`);
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==============================================================
// RENDER 2: HIGH-PRIORITY DUE DATE ALERT BANNER (<= 3 DAYS)
// ==============================================================
function renderDueDateAlerts() {
  const banner = document.getElementById('due-alert-banner');
  const listEl = document.getElementById('due-alert-list');

  if (!state.dueAlerts || state.dueAlerts.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  listEl.innerHTML = state.dueAlerts.map(alert => {
    const dayLabel = alert.days_until_due === 0
      ? 'Due TODAY'
      : alert.days_until_due === 1
        ? 'Due in 1 day'
        : `Due in ${alert.days_until_due} days`;

    return `
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-bold text-amber-200">⚠️ ${dayLabel}:</span>
        <span class="font-extrabold text-white">${formatPHP(alert.monthly_due)}</span>
        <span class="text-slate-200">for <strong class="text-white">${escapeHtml(alert.item_name)}</strong></span>
        <span class="text-xs px-2 py-0.5 rounded-md bg-slate-900/70 text-amber-300 border border-amber-500/30">${escapeHtml(alert.platform)} • Day ${alert.due_day}</span>
        <button onclick="openPayLoanModal(${alert.id})"
          class="text-xs font-bold underline text-emerald-300 hover:text-emerald-200 ml-1">
          Mark Paid Now
        </button>
      </div>
    `;
  }).join('');
}

// ==============================================================
// RENDER 3: BNPL & LOAN INSTALLMENTS
// ==============================================================
function renderLoans() {
  const grid = document.getElementById('loans-grid');
  if (!state.loans.length) {
    grid.innerHTML = `
      <div class="md:col-span-2 glass-card rounded-2xl p-8 text-center text-slate-400 text-sm">
        No BNPL or loan installments tracked yet. Click <strong>"New BNPL / Installment"</strong> to track SPayLater, TikTok PayLater, LazPayLater, Billease, or GCredit!
      </div>
    `;
    return;
  }

  grid.innerHTML = state.loans.map(loan => {
    const isPub = loan.visibility === 'public';
    const isDone = loan.is_completed;
    const isDueSoon = loan.is_due_soon && !isDone;

    const borderClass = isDueSoon
      ? 'border-amber-500/60 bg-gradient-to-br from-amber-950/25 via-slate-900/90 to-slate-900/90'
      : isDone
        ? 'border-emerald-500/35 opacity-80'
        : 'border-slate-800';

    return `
      <div class="glass-card rounded-2xl p-5 border ${borderClass} flex flex-col justify-between gap-4">
        <div>
          <!-- Top Row: Platform Badge, Due Day & Privacy Toggle -->
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ${escapeHtml(loan.platform)}
              </span>
              <span class="text-xs text-slate-400">
                Every <strong>Day ${loan.due_day}</strong> of month
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              ${isDueSoon ? `
                <span class="px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse-subtle">
                  ⚠️ ${escapeHtml(loan.due_status_text)}
                </span>
              ` : isDone ? `
                <span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ✓ Completed
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-400">
                  ${escapeHtml(loan.due_status_text)}
                </span>
              `}

              <button onclick="quickToggleLoanVisibility(${loan.id}, '${isPub ? 'private' : 'public'}')"
                class="px-2 py-0.5 rounded-lg text-[11px] font-bold border transition ${
                  isPub
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }">
                ${isPub ? '🌐 Public' : '🔒 Private'}
              </button>

              <button onclick="deleteLoan(${loan.id})" title="Delete Installment"
                class="text-slate-500 hover:text-rose-400 text-xs px-1.5">
                🗑️
              </button>
            </div>
          </div>

          <!-- Title & Monthly Due -->
          <div class="flex items-baseline justify-between gap-2 mt-1">
            <h3 class="text-base font-extrabold text-white">${escapeHtml(loan.item_name)}</h3>
            <div class="text-right shrink-0">
              <span class="text-xs text-slate-400">Monthly Due:</span>
              <span class="text-base font-extrabold text-amber-300 ml-1">${formatPHP(loan.monthly_due)}</span>
            </div>
          </div>

          <!-- Progress Bar & Completion Text -->
          <div class="mt-3">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="font-semibold text-slate-200">
                Paid ${loan.months_paid}/${loan.term_months} months — ${formatPHP(loan.paid_amount)} / ${formatPHP(loan.total_price)}
              </span>
              <span class="font-bold text-emerald-400">${loan.progress_pct}%</span>
            </div>
            <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style="width: ${loan.progress_pct}%"></div>
            </div>
          </div>
        </div>

        <!-- Bottom Action Bar -->
        <div class="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
          <span class="text-slate-400">
            Remaining Balance: <strong class="text-slate-200">${formatPHP(loan.remaining_amount)}</strong>
          </span>

          ${!isDone ? `
            <button onclick="openPayLoanModal(${loan.id})"
              class="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition">
              ✓ Mark Month as Paid (${formatPHP(loan.monthly_due)})
            </button>
          ` : `
            <span class="text-emerald-400 font-bold">All ${loan.term_months} months paid 🎉</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function quickToggleLoanVisibility(loanId, nextVisibility) {
  try {
    await apiFetch(`/api/loans/${loanId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: nextVisibility })
    });
    showToast(`Installment visibility set to ${nextVisibility === 'public' ? 'Public (Friends)' : 'Private (Only Me)'}`);
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteLoan(loanId) {
  try {
    await apiFetch(`/api/loans/${loanId}`, { method: 'DELETE' });
    showToast('Installment record removed.');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==============================================================
// RENDER 4: PERSONAL VAULT TRANSACTIONS LIST
// ==============================================================
function renderVaultTransactions() {
  const catFilter = document.getElementById('vault-category-filter').value;
  const visFilter = document.getElementById('vault-privacy-filter').value;
  const listEl = document.getElementById('vault-transactions-list');

  const filtered = state.transactions.filter(t => {
    if (catFilter !== 'ALL' && t.category !== catFilter) return false;
    if (visFilter !== 'ALL' && t.visibility !== visFilter) return false;
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="glass-card rounded-2xl p-8 text-center text-slate-400 text-sm">
        No transactions match your current filter. Click <strong>"+ Log Expense"</strong> to record a spend!
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(tx => {
    const meta = CATEGORY_META[tx.category] || CATEGORY_META['Bills & Others'];
    const isPub = tx.visibility === 'public';

    return `
      <div class="glass-card glass-card-hover rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${meta.badgeClass} border flex items-center justify-center text-lg shrink-0">
            ${meta.icon}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-sm font-bold text-white">${escapeHtml(tx.title)}</h4>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-emerald-300 border border-slate-700">
                ${escapeHtml(tx.platform_tag)}
              </span>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.badgeClass} border">
                ${escapeHtml(tx.category)}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Paid via <strong class="text-slate-200">${escapeHtml(tx.wallet_name)}</strong> • ${escapeHtml(String(tx.tx_date).slice(0, 10))}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
          <span class="text-base font-extrabold text-rose-400">
            -${formatPHP(tx.amount)}
          </span>

          <div class="flex items-center gap-1.5">
            <button onclick="quickToggleTxVisibility(${tx.id}, '${isPub ? 'private' : 'public'}')"
              title="Toggle Private vs Public"
              class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                isPub
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }">
              ${isPub ? '🌐 Public (Friends)' : '🔒 Private (Only Me)'}
            </button>

            <button onclick="deleteTransaction(${tx.id})" title="Delete & Refund Wallet"
              class="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs transition">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function quickToggleTxVisibility(txId, nextVisibility) {
  try {
    await apiFetch(`/api/transactions/${txId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: nextVisibility })
    });
    showToast(`Expense visibility changed to ${nextVisibility === 'public' ? 'Public (Friends)' : 'Private (Only Me)'}`);
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTransaction(txId) {
  try {
    await apiFetch(`/api/transactions/${txId}`, { method: 'DELETE' });
    showToast('Expense deleted & amount restored to wallet.');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==============================================================
// RENDER 5: CHART.JS ANALYTICS & VISUALIZATION
// ==============================================================
function renderAnalyticsCharts() {
  const realExpenses = state.transactions.filter(t => t.category !== 'Adjustment');

  // 1. SPENDING BREAKDOWN DONUT CHART
  const categories = [
    'Food & Dining',
    'Commute / Transport',
    'Online Shopping',
    'Gaming Spends',
    'Bills & Others'
  ];
  const categoryTotals = categories.map(cat =>
    realExpenses
      .filter(t => t.category === cat)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  );

  const ctxDonut = document.getElementById('categoryDonutChart').getContext('2d');
  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: ['Food & Dining', 'Commute', 'Online Shopping', 'Gaming Spends', 'Bills & Others'],
      datasets: [{
        data: categoryTotals,
        backgroundColor: ['#10b981', '#06b6d4', '#f59e0b', '#6366f1', '#f43f5e'],
        borderColor: '#090d16',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#cbd5e1', font: { size: 11 }, boxWidth: 10, padding: 10 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatPHP(ctx.raw)}`
          }
        }
      }
    }
  });

  // 2. GAMING & SHOPPING DEEP-DIVE BAR CHART
  const deepDivePlatforms = [
    'Valorant', 'Steam', 'Roblox', 'Mobile Legends', 'CODM',
    'Shopee', 'Lazada', 'TikTok'
  ];
  const platformTotals = deepDivePlatforms.map(p =>
    realExpenses
      .filter(t => String(t.platform_tag).toLowerCase() === p.toLowerCase())
      .reduce((sum, t) => sum + Number(t.amount), 0)
  );

  const ctxBar = document.getElementById('platformBarChart').getContext('2d');
  if (platformChartInstance) platformChartInstance.destroy();
  platformChartInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: ['Val', 'Steam', 'Roblox', 'ML', 'CODM', 'Shopee', 'Lazada', 'TikTok'],
      datasets: [{
        label: 'PHP Spent (₱)',
        data: platformTotals,
        backgroundColor: [
          '#818cf8', '#6366f1', '#4f46e5', '#a855f7', '#8b5cf6',
          '#f59e0b', '#fb923c', '#10b981'
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: (v) => '₱' + v.toLocaleString()
          },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Spent: ${formatPHP(ctx.raw)}`
          }
        }
      }
    }
  });

  // 3. MONTHLY CASH OUTFLOW TREND AREA/LINE CHART
  const dateMap = new Map();
  // Seed last 7 days so chart always looks continuous
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, 0);
  }
  for (const tx of realExpenses) {
    const key = String(tx.tx_date).slice(0, 10);
    dateMap.set(key, (dateMap.get(key) || 0) + Number(tx.amount));
  }

  const sortedDates = Array.from(dateMap.keys()).sort();
  const trendLabels = sortedDates.map(d => d.slice(5)); // MM-DD
  const trendValues = sortedDates.map(d => dateMap.get(d));

  const ctxTrend = document.getElementById('outflowTrendChart').getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'Daily Cash Outflow (₱)',
        data: trendValues,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        borderWidth: 2.5,
        pointBackgroundColor: '#10b981',
        pointRadius: 3.5,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: (v) => '₱' + v.toLocaleString()
          },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Outflow: ${formatPHP(ctx.raw)}`
          }
        }
      }
    }
  });
}

// ==============================================================
// RENDER 6: SHARED SOCIAL FEED (PUBLIC RECORDS ACROSS FRIENDS)
// ==============================================================
function renderSavingsTab() {
  const countBadge = document.getElementById('savings-count-badge');
  if (countBadge) countBadge.textContent = state.savings.length;

  const { total_saved, total_target, total_annual_interest } = state.savingsSummary;
  const overallPct = total_target > 0 ? Math.min(100, Math.round((total_saved / total_target) * 100)) : 0;

  // Digital bank liquid balances (GoTyme + MariBank + Maya)
  const digitalBankTotal = state.wallets
    .filter(w => ['GoTyme', 'MariBank', 'Maya'].includes(w.wallet_name))
    .reduce((sum, w) => sum + Number(w.balance), 0);

  document.getElementById('savings-total-saved').textContent = formatPHP(total_saved);
  document.getElementById('savings-total-target-sub').textContent = `of ${formatPHP(total_target)} combined goal target`;
  document.getElementById('savings-digital-banks-total').textContent = formatPHP(digitalBankTotal);
  document.getElementById('savings-annual-interest').textContent = `+${formatPHP(total_annual_interest)}/yr`;
  document.getElementById('savings-monthly-interest').textContent = `~${formatPHP(total_annual_interest / 12)}/mo net (after 20% tax)`;
  document.getElementById('savings-overall-pct').textContent = `${overallPct}%`;
  document.getElementById('savings-overall-bar').style.width = `${overallPct}%`;

  // Render Savings Goals Grid
  const goalsGrid = document.getElementById('savings-goals-grid');
  if (!state.savings.length) {
    goalsGrid.innerHTML = `
      <div class="md:col-span-2 glass-card rounded-2xl p-8 text-center text-slate-400 text-sm">
        No savings goals or alkansya created yet. Click <strong>"+ New Savings Goal / Alkansya"</strong> to start saving!
      </div>
    `;
  } else {
    goalsGrid.innerHTML = state.savings.map(goal => {
      const isPub = goal.visibility === 'public';
      const isDone = goal.is_completed;
      return `
        <div class="glass-card glass-card-hover rounded-2xl p-5 border ${isDone ? 'border-emerald-500/50' : 'border-cyan-500/25'} flex flex-col justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  🏦 ${escapeHtml(goal.storage_bank)}
                </span>
                <span class="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  ${goal.interest_rate}% p.a.
                </span>
              </div>

              <div class="flex items-center gap-1.5">
                <button onclick="quickToggleSavingsVisibility(${goal.id}, '${isPub ? 'private' : 'public'}')"
                  class="px-2 py-0.5 rounded-lg text-[11px] font-bold border transition ${
                    isPub
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }">
                  ${isPub ? '🌐 Public' : '🔒 Private'}
                </button>
                <button onclick="deleteSavingsGoal(${goal.id})" title="Delete Savings Goal"
                  class="text-slate-500 hover:text-rose-400 text-xs px-1.5">
                  🗑️
                </button>
              </div>
            </div>

            <div class="flex items-baseline justify-between gap-2 mt-1">
              <h3 class="text-base font-extrabold text-white">${escapeHtml(goal.title)}</h3>
              ${goal.target_date ? `<span class="text-[11px] text-slate-400 shrink-0">Target: ${escapeHtml(String(goal.target_date).slice(0, 10))}</span>` : ''}
            </div>

            <div class="mt-3">
              <div class="flex items-center justify-between text-xs mb-1.5">
                <span class="font-semibold text-slate-200">
                  Saved ${formatPHP(goal.current_amount)} of ${formatPHP(goal.target_amount)}
                </span>
                <span class="font-bold text-cyan-400">${goal.progress_pct}%</span>
              </div>
              <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                  style="width: ${goal.progress_pct}%"></div>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs">
            <div>
              <span class="text-slate-400 block">Est. Net Interest: <strong class="text-amber-300">+${formatPHP(goal.est_annual_interest)}/yr</strong></span>
              <span class="text-[11px] text-slate-500">Remaining to goal: ${formatPHP(goal.remaining_to_goal)}</span>
            </div>

            <button onclick="openDepositSavingsModal(${goal.id})"
              class="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow transition">
              ＋ Deposit / Save
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Wallets Quick Overview in Savings Tab
  const walletsOverview = document.getElementById('savings-wallets-overview');
  if (walletsOverview) {
    walletsOverview.innerHTML = state.wallets.map(w => {
      const meta = WALLET_META[w.wallet_name] || WALLET_META.Cash;
      return `
        <div class="glass-card ${meta.colorClass} rounded-2xl p-3.5 border flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white">${escapeHtml(w.wallet_name)}</span>
            <button onclick="openWalletModal(${w.id})" class="text-[11px] text-emerald-300 hover:underline font-semibold">Edit</button>
          </div>
          <p class="text-base font-extrabold text-white mt-2">${formatPHP(w.balance)}</p>
          <span class="text-[10px] text-slate-400 mt-0.5">${meta.subtitle}</span>
        </div>
      `;
    }).join('');
  }
}

async function quickToggleSavingsVisibility(goalId, nextVisibility) {
  try {
    await apiFetch(`/api/savings/${goalId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility: nextVisibility })
    });
    showToast(`Savings goal set to ${nextVisibility === 'public' ? 'Public (Friends)' : 'Private (Only Me)'}`);
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSavingsGoal(goalId) {
  try {
    await apiFetch(`/api/savings/${goalId}`, { method: 'DELETE' });
    showToast('Savings goal deleted.');
    await refreshAllData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderSharedFeed() {
  const { transactions = [], loans = [], savings = [], wallets = [], friends = [] } = state.feed;

  // Update count badge on nav tab
  document.getElementById('feed-count-badge').textContent = transactions.length + loans.length + savings.length;

  // Render Friend Filter Pills
  const filterContainer = document.getElementById('feed-friends-Writeup');
  if (filterContainer) {
    filterContainer.innerHTML = [
      `<button onclick="setFeedFriendFilter('ALL')"
        class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${
          state.selectedFeedFriend === 'ALL'
            ? 'bg-emerald-500 text-slate-950'
            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
        }">All Friends (${friends.length})</button>`,
      ...friends.map(f => `
        <button onclick="setFeedFriendFilter('${escapeHtml(f.nickname)}')"
          class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            state.selectedFeedFriend === f.nickname
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
          }">
          <span class="w-2 h-2 rounded-full" style="background:${f.avatar_color || '#10b981'}"></span>
          @${escapeHtml(f.nickname)}
        </button>
      `)
    ].join('');
  }

  const filterFn = (item) =>
    state.selectedFeedFriend === 'ALL' || item.nickname === state.selectedFeedFriend;

  // 1. Friends' Public Wallets
  const feedWalletsEl = document.getElementById('feed-wallets-grid');
  const filteredWallets = wallets.filter(filterFn);
  feedWalletsEl.innerHTML = filteredWallets.map(w => {
    const meta = WALLET_META[w.wallet_name] || WALLET_META.Cash;
    return `
      <div class="glass-card rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl ${meta.pillBg} border flex items-center justify-center font-extrabold text-xs">
            ${meta.badge}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-white">${escapeHtml(w.wallet_name)}</span>
              <span class="text-[11px] font-semibold text-emerald-400">@${escapeHtml(w.nickname)}</span>
            </div>
            <p class="text-sm font-extrabold text-white mt-0.5">${formatPHP(w.balance)}</p>
          </div>
        </div>
        <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
          Public
        </span>
      </div>
    `;
  }).join('');

  // 2. Friends' Public Transactions
  const feedTxEl = document.getElementById('feed-transactions-list');
  const filteredTx = transactions.filter(filterFn);
  feedTxEl.innerHTML = filteredTx.length ? filteredTx.map(tx => {
    const meta = CATEGORY_META[tx.category] || CATEGORY_META['Bills & Others'];
    return `
      <div class="glass-card rounded-2xl p-4 border border-slate-800/90 flex items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold text-slate-950 shrink-0 mt-0.5"
            style="background:${tx.avatar_color || '#10b981'}">
            ${escapeHtml(tx.nickname.charAt(0).toUpperCase())}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-extrabold text-emerald-400">@${escapeHtml(tx.nickname)}</span>
              <span class="text-xs text-slate-400">spent on</span>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                ${escapeHtml(tx.platform_tag)}
              </span>
            </div>
            <h4 class="text-sm font-bold text-white mt-0.5">${escapeHtml(tx.title)}</h4>
            <p class="text-[11px] text-slate-400 mt-0.5">
              ${meta.icon} ${escapeHtml(tx.category)} • via ${escapeHtml(tx.wallet_name)} • ${escapeHtml(String(tx.tx_date).slice(0, 10))}
            </p>
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-extrabold text-rose-400">-${formatPHP(tx.amount)}</span>
          <span class="block text-[10px] text-slate-500 mt-0.5">🌐 Shared</span>
        </div>
      </div>
    `;
  }).join('') : `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">No public transactions found.</div>`;

  // 3. Friends' Public Savings Goals
  const feedSavingsEl = document.getElementById('feed-savings-list');
  if (feedSavingsEl) {
    const filteredSavings = savings.filter(filterFn);
    feedSavingsEl.innerHTML = filteredSavings.length ? filteredSavings.map(goal => `
      <div class="glass-card rounded-2xl p-4 border border-cyan-500/30 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-950"
              style="background:${goal.avatar_color || '#10b981'}">
              ${escapeHtml(goal.nickname.charAt(0).toUpperCase())}
            </span>
            <span class="text-xs font-bold text-emerald-400">@${escapeHtml(goal.nickname)}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              🏦 ${escapeHtml(goal.storage_bank)} (${goal.interest_rate}% p.a.)
            </span>
          </div>
          <span class="text-xs font-bold text-cyan-300">${goal.progress_pct}%</span>
        </div>

        <h4 class="text-sm font-extrabold text-white">${escapeHtml(goal.title)}</h4>

        <div>
          <div class="flex justify-between text-[11px] text-slate-300 mb-1">
            <span>Saved ${formatPHP(goal.current_amount)} of ${formatPHP(goal.target_amount)}</span>
            <span class="text-amber-300">+${formatPHP(goal.est_annual_interest)}/yr</span>
          </div>
          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full" style="width:${goal.progress_pct}%"></div>
          </div>
        </div>
      </div>
    `).join('') : `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">No public savings goals shared yet.</div>`;
  }

  // 4. Friends' Public BNPL / Loans
  const feedLoansEl = document.getElementById('feed-loans-list');
  const filteredLoans = loans.filter(filterFn);
  feedLoansEl.innerHTML = filteredLoans.length ? filteredLoans.map(loan => `
    <div class="glass-card rounded-2xl p-4 border border-slate-800 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-950"
            style="background:${loan.avatar_color || '#10b981'}">
            ${escapeHtml(loan.nickname.charAt(0).toUpperCase())}
          </span>
          <span class="text-xs font-bold text-emerald-400">@${escapeHtml(loan.nickname)}</span>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            ${escapeHtml(loan.platform)}
          </span>
        </div>
        <span class="text-xs font-bold text-amber-300">${formatPHP(loan.monthly_due)}/mo</span>
      </div>

      <h4 class="text-sm font-extrabold text-white">${escapeHtml(loan.item_name)}</h4>

      <div>
        <div class="flex justify-between text-[11px] text-slate-300 mb-1">
          <span>Paid ${loan.months_paid}/${loan.term_months} months (${formatPHP(loan.paid_amount)} / ${formatPHP(loan.total_price)})</span>
          <span class="font-bold text-emerald-400">${loan.progress_pct}%</span>
        </div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full" style="width:${loan.progress_pct}%"></div>
        </div>
      </div>
    </div>
  `).join('') : `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">No public installments shared yet.</div>`;
}

function setFeedFriendFilter(nickname) {
  state.selectedFeedFriend = nickname;
  renderSharedFeed();
}

// ==============================================================
// NAVIGATION & MODALS
// ==============================================================
function switchMainTab(tab) {
  state.activeTab = tab;
  const vaultContent = document.getElementById('vault-tab-content');
  const savingsContent = document.getElementById('savings-tab-content');
  const feedContent = document.getElementById('feed-tab-content');

  const vaultBtn = document.getElementById('nav-vault-btn');
  const savingsBtn = document.getElementById('nav-savings-btn');
  const feedBtn = document.getElementById('nav-feed-btn');

  const activeClass = 'flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition bg-emerald-500 text-slate-950 shadow flex items-center justify-center gap-1.5';
  const inactiveClass = 'flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5';

  vaultContent.classList.add('hidden');
  savingsContent.classList.add('hidden');
  feedContent.classList.add('hidden');

  vaultBtn.className = inactiveClass;
  savingsBtn.className = inactiveClass;
  feedBtn.className = inactiveClass;

  if (tab === 'vault') {
    vaultContent.classList.remove('hidden');
    vaultBtn.className = activeClass;
    renderAnalyticsCharts();
  } else if (tab === 'savings') {
    savingsContent.classList.remove('hidden');
    savingsBtn.className = activeClass;
    renderSavingsTab();
  } else {
    feedContent.classList.remove('hidden');
    feedBtn.className = activeClass;
    renderSharedFeed();
  }
}

function scrollToSection(id) {
  switchMainTab('vault');
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// --- EXPENSE MODAL ---
function openExpenseModal() {
  document.getElementById('expense-form').reset();
  document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
  updatePlatformPresets();
  document.getElementById('expense-modal').classList.remove('hidden');
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

function updatePlatformPresets() {
  const category = document.getElementById('exp-category').value;
  const select = document.getElementById('exp-platform');
  const pills = document.getElementById('platform-quick-pills');
  const options = CATEGORY_PLATFORMS[category] || ['General'];

  select.innerHTML = options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  pills.innerHTML = options.map(o => `
    <button type="button" onclick="document.getElementById('exp-platform').value='${escapeHtml(o)}'"
      class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 border border-slate-700 transition">
      #${escapeHtml(o)}
    </button>
  `).join('');
}

// --- WALLET MODAL ---
function openWalletModal(walletId) {
  const wallet = state.wallets.find(w => w.id === Number(walletId));
  if (!wallet) return;
  document.getElementById('edit-wallet-id').value = wallet.id;
  document.getElementById('wallet-modal-title').textContent = `Manage ${wallet.wallet_name} Wallet`;
  document.getElementById('edit-wallet-amount').value = wallet.balance;
  document.getElementById('edit-wallet-reason').value = '';
  document.getElementById('edit-wallet-visibility').value = wallet.visibility;
  setWalletAdjustMode('exact', wallet.balance);
  document.getElementById('wallet-modal').classList.remove('hidden');
}

function closeWalletModal() {
  document.getElementById('wallet-modal').classList.add('hidden');
}

function setWalletAdjustMode(mode, defaultVal) {
  state.walletAdjustMode = mode;
  const exactBtn = document.getElementById('wmode-exact-btn');
  const deltaBtn = document.getElementById('wmode-delta-btn');
  const label = document.getElementById('wallet-amount-label');
  const amountInput = document.getElementById('edit-wallet-amount');

  if (mode === 'exact') {
    exactBtn.className = 'py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-slate-950';
    deltaBtn.className = 'py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white';
    label.textContent = 'New Exact Balance (PHP ₱)';
    if (defaultVal !== undefined) amountInput.value = defaultVal;
  } else {
    deltaBtn.className = 'py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-slate-950';
    exactBtn.className = 'py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white';
    label.textContent = 'Adjustment Amount (+500 Cash-In or -200 Deduction)';
    amountInput.value = '';
    amountInput.placeholder = 'e.g. 1500 or -350';
  }
}

// --- LOAN MODAL ---
function openLoanModal() {
  document.getElementById('loan-form').reset();
  const dueIn2Days = ((new Date().getDate() + 1) % 28) + 1;
  document.getElementById('loan-dueday').value = dueIn2Days;
  document.getElementById('loan-modal').classList.remove('hidden');
}

function closeLoanModal() {
  document.getElementById('loan-modal').classList.add('hidden');
}

function autoComputeMonthlyDue() {
  const total = Number(document.getElementById('loan-total').value || 0);
  const term = Number(document.getElementById('loan-term').value || 1);
  if (total > 0 && term > 0) {
    document.getElementById('loan-monthly').value = (total / term).toFixed(2);
  }
}

// --- PAY LOAN INSTALLMENT MODAL ---
function openPayLoanModal(loanId) {
  const loan = state.loans.find(l => l.id === Number(loanId));
  if (!loan) return;
  document.getElementById('pay-loan-id').value = loan.id;
  document.getElementById('pay-loan-summary').innerHTML = `
    Paying <strong>Month ${loan.months_paid + 1} of ${loan.term_months}</strong> for
    <strong class="text-white">${escapeHtml(loan.item_name)}</strong> (${escapeHtml(loan.platform)}).
    This will deduct <strong class="text-emerald-400">${formatPHP(loan.monthly_due)}</strong> from your chosen wallet.
  `;
  document.getElementById('pay-loan-modal').classList.remove('hidden');
}

function closePayLoanModal() {
  document.getElementById('pay-loan-modal').classList.add('hidden');
}

// --- SAVINGS GOAL & DEPOSIT MODALS ---
function openSavingsModal() {
  document.getElementById('savings-form').reset();
  autoSetBankInterest();
  document.getElementById('savings-modal').classList.remove('hidden');
}

function closeSavingsModal() {
  document.getElementById('savings-modal').classList.add('hidden');
}

function autoSetBankInterest() {
  const bank = document.getElementById('sav-bank').value;
  const rateMap = {
    'GoTyme GoSave': 4.0,
    'MariBank': 4.5,
    'Maya Savings': 6.0,
    'GCash GSave': 2.6,
    'Cash Alkansya': 0.0
  };
  if (rateMap[bank] !== undefined) {
    document.getElementById('sav-rate').value = rateMap[bank];
  }
}

function openDepositSavingsModal(goalId) {
  const goal = state.savings.find(g => g.id === Number(goalId));
  if (!goal) return;
  document.getElementById('deposit-goal-id').value = goal.id;
  document.getElementById('deposit-goal-amount').value = '';
  document.getElementById('deposit-deduct-checkbox').checked = false;
  document.getElementById('deposit-savings-summary').innerHTML = `
    Adding funds to <strong class="text-white">${escapeHtml(goal.title)}</strong> (${escapeHtml(goal.storage_bank)}).
    Current progress: <strong class="text-cyan-400">${formatPHP(goal.current_amount)} / ${formatPHP(goal.target_amount)}</strong> (${goal.progress_pct}%).
  `;
  document.getElementById('deposit-savings-modal').classList.remove('hidden');
}

function closeDepositSavingsModal() {
  document.getElementById('deposit-savings-modal').classList.add('hidden');
}

// ==============================================================
// FORM SUBMISSIONS & EVENT LISTENERS
// ==============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkSystemStatus();

  // Auth Form Submit
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('auth-nickname').value.trim();
    const password = document.getElementById('auth-password').value;
    await submitAuth(nickname, password, state.authMode);
  });

  // Expense Form Submit
  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: document.getElementById('exp-title').value,
        amount: Number(document.getElementById('exp-amount').value),
        wallet_name: document.getElementById('exp-wallet').value,
        category: document.getElementById('exp-category').value,
        platform_tag: document.getElementById('exp-platform').value,
        tx_date: document.getElementById('exp-date').value,
        visibility: document.getElementById('exp-visibility').value
      };
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      closeExpenseModal();
      showToast(`Logged ${formatPHP(payload.amount)} from ${payload.wallet_name}!`);
      await refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Wallet Form Submit
  document.getElementById('wallet-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const walletId = document.getElementById('edit-wallet-id').value;
      const val = Number(document.getElementById('edit-wallet-amount').value);
      const reason = document.getElementById('edit-wallet-reason').value.trim();
      const visibility = document.getElementById('edit-wallet-visibility').value;

      const body = { visibility, reason };
      if (state.walletAdjustMode === 'exact') {
        body.balance = val;
      } else {
        body.adjustment_delta = val;
      }

      await apiFetch(`/api/wallets/${walletId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      closeWalletModal();
      showToast('Wallet balance & visibility updated!');
      await refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Loan Form Submit
  document.getElementById('loan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        item_name: document.getElementById('loan-item').value,
        platform: document.getElementById('loan-platform').value,
        total_price: Number(document.getElementById('loan-total').value),
        term_months: Number(document.getElementById('loan-term').value),
        monthly_due: Number(document.getElementById('loan-monthly').value),
        months_paid: Number(document.getElementById('loan-paid').value),
        due_day: Number(document.getElementById('loan-dueday').value),
        visibility: document.getElementById('loan-visibility').value
      };
      await apiFetch('/api/loans', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      closeLoanModal();
      showToast(`Added ${payload.item_name} (${payload.platform}) installment tracker!`);
      await refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Pay Loan Month Submit
  document.getElementById('pay-loan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const loanId = document.getElementById('pay-loan-id').value;
      const walletName = document.getElementById('pay-loan-wallet').value;
      const res = await apiFetch(`/api/loans/${loanId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ wallet_name: walletName })
      });
      closePayLoanModal();
      showToast(res.message);
      await refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Create Savings Goal Submit
  document.getElementById('savings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: document.getElementById('sav-title').value,
        storage_bank: document.getElementById('sav-bank').value,
        interest_rate: Number(document.getElementById('sav-rate').value),
        target_amount: Number(document.getElementById('sav-target').value),
        current_amount: Number(document.getElementById('sav-current').value || 0),
        target_date: document.getElementById('sav-date').value || null,
        visibility: document.getElementById('sav-visibility').value
      };
      await apiFetch('/api/savings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      closeSavingsModal();
      showToast(`Created savings goal "${payload.title}"!`);
      await refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Deposit to Savings Goal Submit
  document.getElementById('deposit-savings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const goalId = document.getElementById('deposit-goal-id').value;
      const amount = Number(document.getElementById('deposit-goal-amount').value);
      const deductWallet = document.getElementById('deposit-deduct-checkbox').checked;
      const sourceWallet = document.getElementById('deposit-source-wallet').value;
      const res = await apiFetch(`/api/savings/${goalId}/contribute`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          deduct_wallet: deductWallet,
          source_wallet: sourceWallet
        })
      });
      closeDepositSavingsModal();
      showToast(res.message);
      await refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Restore session if JWT exists
  if (state.token && state.user) {
    try {
      const me = await apiFetch('/api/auth/me');
      state.user = me.user;
      await enterAppView();
    } catch (e) {
      handleLogout(false);
    }
  }
});
