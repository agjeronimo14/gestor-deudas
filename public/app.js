const $ = (sel) => document.querySelector(sel);

const el = {
  // screens
  login: document.querySelector('#screenLogin'),
  app: document.querySelector('#screenApp'),

  // auth
  loginForm: document.querySelector('#loginForm'),
  loginMsg: document.querySelector('#loginMsg'),
  username: document.querySelector('#username'),
  password: document.querySelector('#password'),
  whoami: document.querySelector('#whoami'),
  btnLogout: document.querySelector('#btnLogout'),
  btnAdmin: document.querySelector('#btnAdmin'),

  // accounts
  accountsList: document.querySelector('#accountsList'),
  btnNewAcc: document.querySelector('#btnNewAcc'),
  btnAccSettings: document.querySelector('#btnAccSettings'),
  btnReloadTx: document.querySelector('#btnReloadTx'),

  // main
  accTitle: document.querySelector('#accTitle'),
  accMeta: document.querySelector('#accMeta'),

  // summary
  sumSaldo: document.querySelector('#sumSaldo'),
  sumAbonos: document.querySelector('#sumAbonos'),
  sumCargos: document.querySelector('#sumCargos'),

  // tx
  txTableBody: document.querySelector('#txTableBody'),
  txEmpty: document.querySelector('#txEmpty'),
  txLoading: document.querySelector('#txLoading'),

  // movement form
  movementCard: document.querySelector('#movementCard'),
  movementForm: document.querySelector('#movementForm'),
  mvMovement: document.querySelector('#mvMovement'),
  mvDate: document.querySelector('#mvDate'),
  mvAmount: document.querySelector('#mvAmount'),
  mvCurrency: document.querySelector('#mvCurrency'),
  mvPayTo: document.querySelector('#mvPayTo'),
  mvNote: document.querySelector('#mvNote'),
  movementMsg: document.querySelector('#movementMsg'),

  // dialogs
  dlgNewAcc: document.querySelector('#dlgNewAcc'),
  dlgEditAcc: document.querySelector('#dlgEditAcc'),
  dlgAdmin: document.querySelector('#dlgAdmin'),
  dlgTempPass: document.querySelector('#dlgTempPass'),

  // new acc form
  accForm: document.querySelector('#accForm'),
  accTitleIn: document.querySelector('#accTitleIn'),
  accKindIn: document.querySelector('#accKindIn'),
  accCurrencyIn: document.querySelector('#accCurrencyIn'),
  accInitialIn: document.querySelector('#accInitialIn'),
  accWeeklyIn: document.querySelector('#accWeeklyIn'),
  accPayToIn: document.querySelector('#accPayToIn'),
  accNotesIn: document.querySelector('#accNotesIn'),
  accViewerIn: document.querySelector('#accViewerIn'),
  accCreateMsg: document.querySelector('#accCreateMsg'),

  // edit acc form
  accEditForm: document.querySelector('#accEditForm'),
  accE_title: document.querySelector('#accE_title'),
  accE_kind: document.querySelector('#accE_kind'),
  accE_currency: document.querySelector('#accE_currency'),
  accE_weekly: document.querySelector('#accE_weekly'),
  accE_payto: document.querySelector('#accE_payto'),
  accE_notes: document.querySelector('#accE_notes'),
  accE_viewer: document.querySelector('#accE_viewer'),
  accEditMsg: document.querySelector('#accEditMsg'),
  btnAccDelete: document.querySelector('#btnAccDelete'),

  // admin
  admUsersBody: document.querySelector('#admUsersBody'),
  admEmpty: document.querySelector('#admEmpty'),
  admLoading: document.querySelector('#admLoading'),
  admCreateForm: document.querySelector('#admCreateForm'),
  admUsername: document.querySelector('#admUsername'),
  admRole: document.querySelector('#admRole'),
  admCreateMsg: document.querySelector('#admCreateMsg'),

  // temp pass
  tempPassValue: document.querySelector('#tempPassValue'),
  btnCopyTemp: document.querySelector('#btnCopyTemp'),
  tempMsg: document.querySelector('#tempMsg')
};

const state = {
  me: null,
  accounts: [],
  selectedAccountId: null,
  selectedAccount: null,
  transactions: [],
  summary: { saldo: 0, total_abonos: 0, total_cargos: 0 }
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function showMsg(node, text, type = '') {
  node.textContent = text || '';
  node.className = `msg ${type}`.trim();
}

async function api(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok || !json) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!json.ok) throw new Error(json.error || 'Error');
  return json.data;
}

async function checkMe() {
  try {
    const data = await api('/api/auth/me');
    state.me = data.user;
    return true;
  } catch {
    state.me = null;
    return false;
  }
}

function setScreen(name) {
  if (name === 'login') {
    el.login.classList.remove('hidden');
    el.app.classList.add('hidden');
  } else {
    el.login.classList.add('hidden');
    el.app.classList.remove('hidden');
  }
}

function renderTopbar() {
  el.whoami.textContent = state.me ? `@${state.me.username} · ${state.me.role}` : '';
  el.btnAdmin.classList.toggle('hidden', !(state.me && state.me.role === 'ADMIN'));
}

function canOwner(acc) {
  return state.me && acc && Number(acc.owner_user_id) === Number(state.me.id);
}

function canViewer(acc) {
  return state.me && acc && acc.viewer_user_id && Number(acc.viewer_user_id) === Number(state.me.id);
}

async function loadAccounts() {
  const data = await api('/api/accounts');
  state.accounts = data.accounts || [];
  if (!state.accounts.length) {
    state.selectedAccountId = null;
    state.selectedAccount = null;
  } else {
    if (!state.selectedAccountId || !state.accounts.find(a => a.id === state.selectedAccountId)) {
      state.selectedAccountId = state.accounts[0].id;
    }
    state.selectedAccount = state.accounts.find(a => a.id === state.selectedAccountId) || null;
  }
  renderAccounts();
  renderSelectedAccountHeader();
}

async function loadTransactions(accountId) {
  if (!accountId) {
    state.transactions = [];
    state.summary = { saldo: 0, total_abonos: 0, total_cargos: 0 };
    renderSummary();
    renderTransactions();
    return;
  }

  el.txLoading.classList.remove('hidden');
  try {
    const data = await api(`/api/transactions?account_id=${encodeURIComponent(accountId)}`);
    state.transactions = data.transactions || [];
    state.summary = data.summary || { saldo: 0, total_abonos: 0, total_cargos: 0 };
  } finally {
    el.txLoading.classList.add('hidden');
  }
  renderSummary();
  renderTransactions();
  renderMovementForm();
}

function renderAccounts() {
  el.accountsList.innerHTML = '';
  for (const acc of state.accounts) {
    const btn = document.createElement('button');
    btn.className = 'acc-item';
    btn.type = 'button';
    if (acc.id === state.selectedAccountId) btn.classList.add('active');

    const badge = document.createElement('span');
    badge.className = `badge ${acc.kind === 'PAYABLE' ? 'payable' : 'receivable'}`;
    badge.textContent = acc.kind === 'PAYABLE' ? 'Debo' : 'Me deben';

    const title = document.createElement('div');
    title.className = 'acc-title';
    title.textContent = acc.title;

    const meta = document.createElement('div');
    meta.className = 'acc-meta';
    const role = Number(acc.owner_user_id) === Number(state.me?.id) ? 'OWNER' : 'VIEWER';
    meta.textContent = `${role} · ${acc.currency}`;

    btn.appendChild(badge);
    btn.appendChild(title);
    btn.appendChild(meta);

    btn.addEventListener('click', async () => {
      state.selectedAccountId = acc.id;
      state.selectedAccount = acc;
      renderAccounts();
      renderSelectedAccountHeader();
      await loadTransactions(acc.id);
    });

    el.accountsList.appendChild(btn);
  }
}

function renderSelectedAccountHeader() {
  const acc = state.selectedAccount;
  if (!acc) {
    el.accTitle.textContent = 'Sin cuentas';
    el.accMeta.textContent = 'Crea una cuenta para comenzar.';
    el.btnAccSettings.classList.add('hidden');
    return;
  }
  el.accTitle.textContent = acc.title;
  const role = canOwner(acc) ? 'OWNER' : 'VIEWER';
  const viewer = acc.viewer_username ? ` · viewer @${acc.viewer_username}` : '';
  el.accMeta.textContent = `${role} · ${acc.kind} · ${acc.currency}${viewer}`;
  el.btnAccSettings.classList.toggle('hidden', !canOwner(acc));
}

function renderSummary() {
  el.sumSaldo.textContent = fmtMoney(state.summary.saldo);
  el.sumAbonos.textContent = fmtMoney(state.summary.total_abonos);
  el.sumCargos.textContent = fmtMoney(state.summary.total_cargos);
}

function renderMovementForm() {
  const acc = state.selectedAccount;
  if (!acc) {
    el.movementCard.classList.add('hidden');
    return;
  }
  if (!canOwner(acc)) {
    el.movementCard.classList.add('hidden');
    return;
  }
  el.movementCard.classList.remove('hidden');
  el.mvCurrency.value = acc.currency;
  if (!el.mvDate.value) el.mvDate.value = todayISO();
}

function renderTransactions() {
  el.txTableBody.innerHTML = '';
  const acc = state.selectedAccount;
  if (!acc || !state.transactions.length) {
    el.txEmpty.classList.remove('hidden');
    return;
  }
  el.txEmpty.classList.add('hidden');

  for (const tx of state.transactions) {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = tx.date;

    const tdMv = document.createElement('td');
    tdMv.innerHTML = `<span class="pill ${tx.movement === 'ABONO' ? 'pill-ok' : 'pill-warn'}">${tx.movement}</span>`;

    const tdAmt = document.createElement('td');
    tdAmt.textContent = fmtMoney(tx.amount);

    const tdSt = document.createElement('td');
    if (tx.movement === 'ABONO') {
      const st = tx.receipt_status || 'PENDIENTE';
      tdSt.innerHTML = `<span class="pill ${st === 'RECIBIDO' ? 'pill-ok' : 'pill-muted'}">${st}</span>`;
    } else {
      tdSt.innerHTML = '<span class="pill pill-muted">—</span>';
    }

    const tdNote = document.createElement('td');
    tdNote.textContent = tx.note || tx.pay_to || '';

    const tdAct = document.createElement('td');
    tdAct.className = 'td-actions';

    if (canViewer(acc) && tx.movement === 'ABONO' && tx.receipt_status === 'PENDIENTE') {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = 'Confirmar recibido';
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await api(`/api/transactions/${tx.id}/confirm-receipt`, { method: 'POST' });
          await loadTransactions(acc.id);
        } catch (e) {
          alert(e.message);
        } finally {
          b.disabled = false;
        }
      });
      tdAct.appendChild(b);
    } else {
      tdAct.innerHTML = '<span class="muted">—</span>';
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdMv);
    tr.appendChild(tdAmt);
    tr.appendChild(tdSt);
    tr.appendChild(tdNote);
    tr.appendChild(tdAct);

    el.txTableBody.appendChild(tr);
  }
}

// --- Auth actions ---
el.loginForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showMsg(el.loginMsg, '', '');
  const username = el.username.value.trim().toLowerCase();
  const password = el.password.value;
  try {
    await api('/api/auth/login', { method: 'POST', body: { username, password } });
    const ok = await checkMe();
    if (!ok) throw new Error('No se pudo validar la sesión');

    setScreen('app');
    renderTopbar();

    await loadAccounts();
    await loadTransactions(state.selectedAccountId);
  } catch (e) {
    showMsg(el.loginMsg, e.message || 'Error', 'err');
  }
});

el.btnLogout.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {}
  state.me = null;
  state.accounts = [];
  state.transactions = [];
  state.selectedAccountId = null;
  state.selectedAccount = null;
  setScreen('login');
});

// --- Account create ---
el.btnNewAcc.addEventListener('click', () => {
  showMsg(el.accCreateMsg, '', '');
  el.accForm.reset();
  el.accInitialIn.value = '0';
  el.accCurrencyIn.value = 'USD';
  el.dlgNewAcc.showModal();
});

el.accForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showMsg(el.accCreateMsg, 'Creando...', '');
  try {
    const viewer = el.accViewerIn.value.trim().toLowerCase();
    await api('/api/accounts', {
      method: 'POST',
      body: {
        title: el.accTitleIn.value,
        kind: el.accKindIn.value,
        currency: el.accCurrencyIn.value,
        initial_amount: Number(el.accInitialIn.value || 0),
        weekly_target: el.accWeeklyIn.value === '' ? null : Number(el.accWeeklyIn.value),
        pay_to: el.accPayToIn.value || null,
        notes: el.accNotesIn.value || null,
        viewer_username: viewer === '' ? null : viewer
      }
    });

    el.dlgNewAcc.close();
    await loadAccounts();
    await loadTransactions(state.selectedAccountId);
  } catch (e) {
    showMsg(el.accCreateMsg, e.message || 'Error', 'err');
  }
});

// --- Account edit/delete ---
el.btnAccSettings.addEventListener('click', () => {
  const acc = state.selectedAccount;
  if (!acc) return;
  showMsg(el.accEditMsg, '', '');

  el.accE_title.value = acc.title;
  el.accE_kind.value = acc.kind;
  el.accE_currency.value = acc.currency;
  el.accE_weekly.value = acc.weekly_target ?? '';
  el.accE_payto.value = acc.pay_to ?? '';
  el.accE_notes.value = acc.notes ?? '';
  el.accE_viewer.value = acc.viewer_username ?? '';

  el.dlgEditAcc.showModal();
});

el.accEditForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const acc = state.selectedAccount;
  if (!acc) return;

  showMsg(el.accEditMsg, 'Guardando...', '');
  try {
    const viewer = el.accE_viewer.value.trim().toLowerCase();
    await api(`/api/accounts/${acc.id}`, {
      method: 'PUT',
      body: {
        title: el.accE_title.value,
        kind: el.accE_kind.value,
        currency: el.accE_currency.value,
        weekly_target: el.accE_weekly.value === '' ? null : Number(el.accE_weekly.value),
        pay_to: el.accE_payto.value === '' ? null : el.accE_payto.value,
        notes: el.accE_notes.value === '' ? null : el.accE_notes.value,
        viewer_username: viewer === '' ? null : viewer
      }
    });

    el.dlgEditAcc.close();
    await loadAccounts();
    // reselect
    state.selectedAccount = state.accounts.find(a => a.id === acc.id) || null;
    renderSelectedAccountHeader();
    await loadTransactions(acc.id);
  } catch (e) {
    showMsg(el.accEditMsg, e.message || 'Error', 'err');
  }
});

el.btnAccDelete.addEventListener('click', async () => {
  const acc = state.selectedAccount;
  if (!acc) return;
  const okDel = confirm('¿Eliminar esta cuenta? (soft delete)');
  if (!okDel) return;

  try {
    await api(`/api/accounts/${acc.id}`, { method: 'DELETE' });
    el.dlgEditAcc.close();
    await loadAccounts();
    await loadTransactions(state.selectedAccountId);
  } catch (e) {
    alert(e.message);
  }
});

// --- Movement create ---
el.movementForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const acc = state.selectedAccount;
  if (!acc) return;

  showMsg(el.movementMsg, 'Registrando...', '');
  try {
    await api('/api/transactions', {
      method: 'POST',
      body: {
        account_id: acc.id,
        movement: el.mvMovement.value,
        date: el.mvDate.value,
        amount: Number(el.mvAmount.value),
        currency: el.mvCurrency.value,
        pay_to: el.mvPayTo.value === '' ? null : el.mvPayTo.value,
        note: el.mvNote.value === '' ? null : el.mvNote.value
      }
    });

    el.movementForm.reset();
    el.mvMovement.value = 'ABONO';
    el.mvDate.value = todayISO();
    el.mvCurrency.value = acc.currency;

    showMsg(el.movementMsg, 'Guardado ✅', 'ok');
    setTimeout(() => showMsg(el.movementMsg, ''), 1200);

    await loadTransactions(acc.id);
  } catch (e) {
    showMsg(el.movementMsg, e.message || 'Error', 'err');
  }
});

el.btnReloadTx.addEventListener('click', async () => {
  if (!state.selectedAccountId) return;
  await loadTransactions(state.selectedAccountId);
});

// --- Admin UI ---
el.btnAdmin.addEventListener('click', async () => {
  el.dlgAdmin.showModal();
  await loadAdminUsers();
});

async function loadAdminUsers() {
  el.admLoading.classList.remove('hidden');
  el.admEmpty.classList.add('hidden');
  el.admUsersBody.innerHTML = '';
  try {
    const data = await api('/api/admin/users');
    const users = data.users || [];

    if (!users.length) {
      el.admEmpty.classList.remove('hidden');
      return;
    }

    for (const u of users) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>@${u.username}</td>
        <td><span class="pill pill-muted">${u.role}</span></td>
        <td><span class="pill ${u.is_active === 1 ? 'pill-ok' : 'pill-warn'}">${u.is_active === 1 ? 'Activo' : 'Inactivo'}</span></td>
        <td>${(u.created_at || '').replace('T',' ').slice(0,19)}</td>
        <td class="td-actions"><button class="btn secondary small" data-reset="${u.id}">Reset pass</button></td>
      `;
      el.admUsersBody.appendChild(tr);
    }

    // bind reset buttons
    el.admUsersBody.querySelectorAll('button[data-reset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-reset');
        btn.disabled = true;
        try {
          const data = await api(`/api/admin/users/${id}/reset-password`, { method: 'POST' });
          openTempPassword(data.temp_password);
        } catch (e) {
          alert(e.message);
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    alert(e.message);
  } finally {
    el.admLoading.classList.add('hidden');
  }
}

el.admCreateForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  showMsg(el.admCreateMsg, 'Creando...', '');
  try {
    const data = await api('/api/admin/users', {
      method: 'POST',
      body: {
        username: el.admUsername.value,
        role: el.admRole.value
      }
    });
    showMsg(el.admCreateMsg, '', '');
    el.admCreateForm.reset();
    await loadAdminUsers();
    openTempPassword(data.temp_password);
  } catch (e) {
    showMsg(el.admCreateMsg, e.message || 'Error', 'err');
  }
});

function openTempPassword(tp) {
  el.tempPassValue.textContent = tp;
  showMsg(el.tempMsg, '', '');
  el.dlgTempPass.showModal();
}

el.btnCopyTemp.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.tempPassValue.textContent || '');
    showMsg(el.tempMsg, 'Copiado ✅', 'ok');
    setTimeout(() => showMsg(el.tempMsg, ''), 1000);
  } catch {
    showMsg(el.tempMsg, 'No se pudo copiar', 'err');
  }
});

// --- boot ---
(async function main() {
  el.mvDate.value = todayISO();

  const logged = await checkMe();
  if (!logged) {
    setScreen('login');
    return;
  }

  setScreen('app');
  renderTopbar();

  await loadAccounts();
  await loadTransactions(state.selectedAccountId);
})();
