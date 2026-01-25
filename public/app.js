/* Gestor de Deudas - Frontend (Cloudflare Pages static) */
/* v2: IDs alineados con public/index.html */

console.log('[GESTOR-DEUDAS] app.js v2 loaded');

const $ = (id) => document.getElementById(id);

const el = {
  // Topbar
  whoami: $('whoami'),
  btnAdmin: $('btnAdmin'),
  btnLogout: $('btnLogout'),

  // Vistas
  viewLogin: $('viewLogin'),
  viewApp: $('viewApp'),

  // Login
  loginForm: $('loginForm'),
  loginUsername: $('loginUsername'),
  loginPassword: $('loginPassword'),
  loginMsg: $('loginMsg'),

  // App
  btnNewAccount: $('btnNewAccount'),
  accountsList: $('accountsList'),
  accountsEmpty: $('accountsEmpty'),
  loadingTop: $('loadingTop'),

  accountTitle: $('accountTitle'),
  accountMeta: $('accountMeta'),
  btnAccountSettings: $('btnAccountSettings'),

  sumSaldo: $('sumSaldo'),
  sumAbonos: $('sumAbonos'),
  sumCargos: $('sumCargos'),

  ownerPanel: $('ownerPanel'),

  // Movimientos
  txForm: $('txForm'),
  txMovement: $('txMovement'),
  txDate: $('txDate'),
  txAmount: $('txAmount'),
  txCurrency: $('txCurrency'),
  txNote: $('txNote'),
  txMsg: $('txMsg'),

  txBody: $('txBody'),
  txEmpty: $('txEmpty'),

  // Modal crear cuenta
  dlgAccount: $('dlgAccount'),
  accountForm: $('accountForm'),
  accTitle: $('accTitle'),
  accKind: $('accKind'),
  accCurrency: $('accCurrency'),
  accInitial: $('accInitial'),
  accWeekly: $('accWeekly'),
  accPayTo: $('accPayTo'),
  accNotes: $('accNotes'),
  accViewer: $('accViewer'),
  accMsg: $('accMsg'),

  // Modal editar cuenta
  dlgAccountEdit: $('dlgAccountEdit'),
  accountEditForm: $('accountEditForm'),
  eAccTitle: $('eAccTitle'),
  eAccKind: $('eAccKind'),
  eAccCurrency: $('eAccCurrency'),
  eAccWeekly: $('eAccWeekly'),
  eAccPayTo: $('eAccPayTo'),
  eAccNotes: $('eAccNotes'),
  eAccViewer: $('eAccViewer'),
  eAccMsg: $('eAccMsg'),
  btnDeleteAccount: $('btnDeleteAccount'),

  // Admin
  dlgAdmin: $('dlgAdmin'),
  adminForm: $('adminForm'),
  admNewUser: $('admNewUser'),
  admRole: $('admRole'),
  btnCreateUser: $('btnCreateUser'),
  btnReloadUsers: $('btnReloadUsers'),
  usersBody: $('usersBody'),
  admMsg: $('admMsg'),

  // Temp pass
  dlgTempPass: $('dlgTempPass'),
  tempPassValue: $('tempPassValue'),
  btnCopyTemp: $('btnCopyTemp'),
  tempMsg: $('tempMsg'),
};

function on(target, event, handler) {
  if (!target) {
    console.warn('[GESTOR-DEUDAS] Missing element for', event);
    return;
  }
  target.addEventListener(event, handler);
}

function setText(node, text) {
  if (node) node.textContent = text ?? '';
}

function setHtml(node, html) {
  if (node) node.innerHTML = html ?? '';
}

function show(node) {
  if (!node) return;
  node.classList.remove('hidden');
}

function hide(node) {
  if (!node) return;
  node.classList.add('hidden');
}

function money(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(num);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function api(path, opts = {}) {
  const options = {
    method: opts.method || 'GET',
    headers: { ...(opts.headers || {}) },
    credentials: 'include',
  };
  if (opts.body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(opts.body);
  }

  const res = await fetch(path, options);
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  if (payload && payload.ok === false) {
    const err = new Error(payload.error || 'Error');
    err.status = 400;
    err.payload = payload;
    throw err;
  }

  return payload?.data ?? payload;
}

const state = {
  me: null,
  accounts: [],
  selectedAccountId: null,
  tx: [],
  account: null,
  summary: null,
};

function setLoginMessage(msg) {
  setText(el.loginMsg, msg || '');
}

function setTxMessage(msg) {
  setText(el.txMsg, msg || '');
}

function setAccMessage(msg) {
  setText(el.accMsg, msg || '');
}

function setEAccMessage(msg) {
  setText(el.eAccMsg, msg || '');
}

function setAdminMessage(msg) {
  setText(el.admMsg, msg || '');
}

function setTopLoading(isLoading) {
  if (!el.loadingTop) return;
  if (isLoading) show(el.loadingTop);
  else hide(el.loadingTop);
}

function showLogin() {
  show(el.viewLogin);
  hide(el.viewApp);
}

function showApp() {
  hide(el.viewLogin);
  show(el.viewApp);
}

function renderWhoAmI() {
  if (!state.me) {
    setText(el.whoami, '');
    hide(el.btnAdmin);
    return;
  }
  setText(el.whoami, `${state.me.username} · ${state.me.role}`);
  if (state.me.role === 'ADMIN') show(el.btnAdmin);
  else hide(el.btnAdmin);
}

function renderAccounts() {
  const list = el.accountsList;
  if (!list) return;

  setHtml(list, '');
  if (!state.accounts || state.accounts.length === 0) {
    show(el.accountsEmpty);
    return;
  }
  hide(el.accountsEmpty);

  for (const acc of state.accounts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acc-item' + (Number(acc.id) === Number(state.selectedAccountId) ? ' active' : '');

    const roleBadge = acc.can_write ? '<span class="badge ok">OWNER</span>' : '<span class="badge">VIEWER</span>';

    btn.innerHTML = `
      <div class="acc-title">${escapeHtml(acc.title)}</div>
      <div class="acc-sub">
        <span class="muted">${escapeHtml(acc.kind)} · ${escapeHtml(acc.currency)}</span>
        ${roleBadge}
      </div>
    `;

    btn.addEventListener('click', () => selectAccount(acc.id));
    list.appendChild(btn);
  }
}

function renderHeaderAccount() {
  const acc = state.account;
  if (!acc) {
    setText(el.accountTitle, 'Selecciona una cuenta');
    setText(el.accountMeta, '');
    hide(el.btnAccountSettings);
    return;
  }
  setText(el.accountTitle, acc.title);

  const role = acc.my_role;
  const meta = `${acc.kind} · ${acc.currency} · ${role}`;
  setText(el.accountMeta, meta);

  if (acc.can_write) show(el.btnAccountSettings);
  else hide(el.btnAccountSettings);

  if (acc.can_write) show(el.ownerPanel);
  else hide(el.ownerPanel);
}

function renderSummary() {
  const s = state.summary || { saldo: 0, total_abonos: 0, total_cargos: 0 };
  setText(el.sumSaldo, money(s.saldo));
  setText(el.sumAbonos, money(s.total_abonos));
  setText(el.sumCargos, money(s.total_cargos));
}

function renderTransactions() {
  const body = el.txBody;
  if (!body) return;

  setHtml(body, '');

  const txs = state.tx || [];
  if (txs.length === 0) {
    show(el.txEmpty);
    return;
  }
  hide(el.txEmpty);

  for (const t of txs) {
    const tr = document.createElement('tr');

    const status = t.movement === 'ABONO'
      ? (t.receipt_status || 'PENDIENTE')
      : '-';

    const amount = money(t.amount);
    const sign = t.movement === 'CARGO' ? '+' : '-';

    const canConfirm =
      state.account?.my_role === 'VIEWER' &&
      t.movement === 'ABONO' &&
      t.receipt_status === 'PENDIENTE';

    tr.innerHTML = `
      <td class="mono">${escapeHtml(t.date)}</td>
      <td><span class="pill ${t.movement === 'ABONO' ? 'pill-ok' : 'pill-warn'}">${escapeHtml(t.movement)}</span></td>
      <td class="right mono">${sign}${amount}</td>
      <td>${escapeHtml(t.note || '')}</td>
      <td>${renderReceiptBadge(status)}</td>
      <td class="right">${canConfirm ? '<button class="btn small" data-confirm="1">Confirmar</button>' : ''}</td>
    `;

    if (canConfirm) {
      const btn = tr.querySelector('button[data-confirm="1"]');
      btn.addEventListener('click', async () => {
        await confirmReceipt(t.id);
      });
    }

    body.appendChild(tr);
  }
}

function renderReceiptBadge(status) {
  if (status === '-' || status === null) return '<span class="muted">-</span>';
  if (status === 'RECIBIDO') return '<span class="badge ok">RECIBIDO</span>';
  return '<span class="badge">PENDIENTE</span>';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function bootstrap() {
  setTopLoading(true);
  try {
    const me = await api('/api/auth/me');
    state.me = me.user;
    renderWhoAmI();
    showApp();

    // Cuentas
    const accData = await api('/api/accounts');
    state.accounts = accData.accounts || [];
    renderAccounts();

    // Auto-select
    if (state.accounts.length > 0) {
      const pick = state.selectedAccountId || state.accounts[0].id;
      await selectAccount(pick);
    } else {
      state.selectedAccountId = null;
      state.account = null;
      state.summary = null;
      state.tx = [];
      renderHeaderAccount();
      renderSummary();
      renderTransactions();
    }
  } catch (e) {
    // Not logged
    state.me = null;
    showLogin();
    renderWhoAmI();
  } finally {
    setTopLoading(false);
  }
}

async function selectAccount(accountId) {
  state.selectedAccountId = Number(accountId);
  renderAccounts();

  if (!state.selectedAccountId) return;

  setTopLoading(true);
  try {
    const data = await api(`/api/transactions?account_id=${state.selectedAccountId}`);
    state.account = data.account;
    state.summary = data.summary;
    state.tx = data.transactions || [];

    renderHeaderAccount();
    renderSummary();
    renderTransactions();

    // default currency in form
    if (el.txCurrency && state.account?.currency) el.txCurrency.value = state.account.currency;
  } catch (e) {
    console.error(e);
    setTxMessage(e.message);
  } finally {
    setTopLoading(false);
  }
}

async function doLogin(username, password) {
  setLoginMessage('');
  try {
    await api('/api/auth/login', { method: 'POST', body: { username, password } });
    // Bootstrap after login
    await bootstrap();
  } catch (e) {
    setLoginMessage(e.message === 'HTTP 401' ? 'Credenciales inválidas' : e.message);
    throw e;
  }
}

async function doLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  state.me = null;
  state.accounts = [];
  state.selectedAccountId = null;
  state.account = null;
  state.summary = null;
  state.tx = [];
  showLogin();
  renderWhoAmI();
}

async function createAccountFromModal() {
  setAccMessage('');

  const title = el.accTitle?.value?.trim();
  const kind = el.accKind?.value;
  const currency = el.accCurrency?.value?.trim();
  const initial_amount = Number(el.accInitial?.value || 0);
  const weekly_target = el.accWeekly?.value ? Number(el.accWeekly.value) : null;
  const pay_to = el.accPayTo?.value?.trim() || null;
  const notes = el.accNotes?.value?.trim() || null;
  const viewer_username = el.accViewer?.value?.trim() || null;

  await api('/api/accounts', {
    method: 'POST',
    body: {
      title,
      kind,
      currency,
      initial_amount,
      weekly_target,
      pay_to,
      notes,
      viewer_username,
    },
  });

  // Close modal
  el.dlgAccount?.close();

  // Reload accounts
  const accData = await api('/api/accounts');
  state.accounts = accData.accounts || [];
  renderAccounts();

  if (state.accounts.length > 0) {
    await selectAccount(state.accounts[0].id);
  }
}

async function openEditAccount() {
  const accId = state.selectedAccountId;
  if (!accId) return;

  // Ensure latest from list
  const acc = state.accounts.find((a) => Number(a.id) === Number(accId));
  if (!acc || !acc.can_write) return;

  setEAccMessage('');

  el.eAccTitle.value = acc.title || '';
  el.eAccKind.value = acc.kind || 'PAYABLE';
  el.eAccCurrency.value = acc.currency || 'USD';
  el.eAccWeekly.value = acc.weekly_target ?? '';
  el.eAccPayTo.value = acc.pay_to || '';
  el.eAccNotes.value = acc.notes || '';
  el.eAccViewer.value = '';

  el.dlgAccountEdit?.showModal();
}

async function saveAccountEdits() {
  setEAccMessage('');

  const accId = state.selectedAccountId;
  if (!accId) return;

  const title = el.eAccTitle?.value?.trim();
  const kind = el.eAccKind?.value;
  const currency = el.eAccCurrency?.value?.trim();
  const weekly_target = el.eAccWeekly?.value ? Number(el.eAccWeekly.value) : null;
  const pay_to = el.eAccPayTo?.value?.trim() || null;
  const notes = el.eAccNotes?.value?.trim() || null;
  const viewer_username = el.eAccViewer?.value?.trim() || null;

  await api(`/api/accounts/${accId}`, {
    method: 'PUT',
    body: { title, kind, currency, weekly_target, pay_to, notes, viewer_username },
  });

  el.dlgAccountEdit?.close();

  // Reload accounts list
  const accData = await api('/api/accounts');
  state.accounts = accData.accounts || [];
  renderAccounts();

  // Reload tx for selected
  await selectAccount(accId);
}

async function deleteAccountSoft() {
  const accId = state.selectedAccountId;
  if (!accId) return;

  if (!confirm('¿Eliminar (soft delete) esta cuenta? No se borrará de forma física.')) return;

  await api(`/api/accounts/${accId}`, { method: 'DELETE' });
  el.dlgAccountEdit?.close();

  // Reload accounts
  const accData = await api('/api/accounts');
  state.accounts = accData.accounts || [];
  state.selectedAccountId = null;
  renderAccounts();

  if (state.accounts.length > 0) {
    await selectAccount(state.accounts[0].id);
  } else {
    state.account = null;
    state.summary = null;
    state.tx = [];
    renderHeaderAccount();
    renderSummary();
    renderTransactions();
  }
}

async function createTransactionFromForm() {
  setTxMessage('');

  const accId = state.selectedAccountId;
  if (!accId) throw new Error('Selecciona una cuenta');

  const movement = el.txMovement?.value;
  const date = el.txDate?.value || todayISO();
  const amount = Number(el.txAmount?.value || 0);
  const currency = el.txCurrency?.value?.trim();
  const note = el.txNote?.value?.trim() || null;

  await api('/api/transactions', {
    method: 'POST',
    body: {
      account_id: accId,
      movement,
      date,
      amount,
      currency,
      note,
    },
  });

  // Clear amount/note
  if (el.txAmount) el.txAmount.value = '';
  if (el.txNote) el.txNote.value = '';

  // Reload tx
  await selectAccount(accId);
}

async function confirmReceipt(txId) {
  if (!confirm('Confirmar RECIBIDO para este abono?')) return;

  setTopLoading(true);
  try {
    await api(`/api/transactions/${txId}/confirm-receipt`, { method: 'POST' });
    await selectAccount(state.selectedAccountId);
  } catch (e) {
    alert(e.message);
  } finally {
    setTopLoading(false);
  }
}

// --- Admin ---
async function openAdmin() {
  if (state.me?.role !== 'ADMIN') return;
  setAdminMessage('');
  el.dlgAdmin?.showModal();
  await reloadUsers();
}

async function reloadUsers() {
  setAdminMessage('');
  try {
    const data = await api('/api/admin/users');
    const users = data.users || [];
    renderUsers(users);
  } catch (e) {
    setAdminMessage(e.message);
  }
}

function renderUsers(users) {
  const body = el.usersBody;
  if (!body) return;
  setHtml(body, '');

  for (const u of users) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${u.id}</td>
      <td>${escapeHtml(u.username)}</td>
      <td>${escapeHtml(u.role)}</td>
      <td>${u.is_active ? '<span class="badge ok">ACTIVO</span>' : '<span class="badge">INACTIVO</span>'}</td>
      <td class="right"><button class="btn small" data-reset="1">Reset</button></td>
    `;
    const btn = tr.querySelector('button[data-reset="1"]');
    btn.addEventListener('click', async () => {
      if (!confirm(`Reset password de ${u.username}?`)) return;
      try {
        const r = await api(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' });
        showTempPassword(r.temp_password);
        await reloadUsers();
      } catch (e) {
        alert(e.message);
      }
    });

    body.appendChild(tr);
  }
}

async function createUser() {
  setAdminMessage('');
  const username = el.admNewUser?.value?.trim();
  const role = el.admRole?.value;

  if (!username || username.length < 3) {
    setAdminMessage('Username inválido (mín 3)');
    return;
  }

  try {
    const r = await api('/api/admin/users', { method: 'POST', body: { username, role } });
    el.admNewUser.value = '';
    showTempPassword(r.temp_password);
    await reloadUsers();
  } catch (e) {
    setAdminMessage(e.message);
  }
}

function showTempPassword(tempPassword) {
  if (el.tempPassValue) el.tempPassValue.value = tempPassword || '';
  setText(el.tempMsg, '');
  el.dlgTempPass?.showModal();
}

async function copyTempPassword() {
  try {
    await navigator.clipboard.writeText(el.tempPassValue.value || '');
    setText(el.tempMsg, 'Copiado');
  } catch {
    setText(el.tempMsg, 'No se pudo copiar');
  }
}

// --- Event bindings ---

function bindEvents() {
  // Default date
  if (el.txDate) el.txDate.value = todayISO();

  on(el.loginForm, 'submit', async (ev) => {
    ev.preventDefault();
    const username = el.loginUsername?.value?.trim();
    const password = el.loginPassword?.value ?? '';
    if (!username || !password) {
      setLoginMessage('Ingresa usuario y password');
      return;
    }
    try {
      await doLogin(username, password);
      // clear password after login
      if (el.loginPassword) el.loginPassword.value = '';
    } catch {
      // message already set
    }
  });

  on(el.btnLogout, 'click', async () => {
    await doLogout();
  });

  on(el.btnNewAccount, 'click', () => {
    setAccMessage('');
    if (el.accTitle) el.accTitle.value = '';
    if (el.accCurrency) el.accCurrency.value = (state.account?.currency || 'USD');
    if (el.accInitial) el.accInitial.value = '0';
    if (el.accWeekly) el.accWeekly.value = '';
    if (el.accPayTo) el.accPayTo.value = '';
    if (el.accNotes) el.accNotes.value = '';
    if (el.accViewer) el.accViewer.value = '';
    el.dlgAccount?.showModal();
  });

  on(el.accountForm, 'submit', async (ev) => {
    // Allow dialog close on cancel button
    if (ev.submitter && ev.submitter.value === 'cancel') return;
    ev.preventDefault();
    try {
      await createAccountFromModal();
    } catch (e) {
      setAccMessage(e.message);
    }
  });

  on(el.btnAccountSettings, 'click', async () => {
    await openEditAccount();
  });

  on(el.accountEditForm, 'submit', async (ev) => {
    if (ev.submitter && ev.submitter.value === 'cancel') return;
    ev.preventDefault();
    try {
      await saveAccountEdits();
    } catch (e) {
      setEAccMessage(e.message);
    }
  });

  on(el.btnDeleteAccount, 'click', async () => {
    try {
      await deleteAccountSoft();
    } catch (e) {
      setEAccMessage(e.message);
    }
  });

  on(el.txForm, 'submit', async (ev) => {
    ev.preventDefault();
    try {
      await createTransactionFromForm();
    } catch (e) {
      setTxMessage(e.message);
    }
  });

  on(el.btnAdmin, 'click', async () => {
    await openAdmin();
  });

  on(el.btnReloadUsers, 'click', async () => {
    await reloadUsers();
  });

  on(el.btnCreateUser, 'click', async () => {
    await createUser();
  });

  on(el.btnCopyTemp, 'click', async () => {
    await copyTempPassword();
  });
}

async function main() {
  bindEvents();
  await bootstrap();
}

main().catch((e) => console.error(e));
