const q = (id) => document.getElementById(id);

const el = {
  // views
  viewLogin: q("viewLogin"),
  viewApp: q("viewApp"),

  // topbar
  whoami: q("whoami"),
  btnAdmin: q("btnAdmin"),
  btnLogout: q("btnLogout"),

  // login
  loginForm: q("loginForm"),
  loginUsername: q("loginUsername"),
  loginPassword: q("loginPassword"),
  loginMsg: q("loginMsg"),

  // accounts
  btnNewAccount: q("btnNewAccount"),
  accountsList: q("accountsList"),
  accountsEmpty: q("accountsEmpty"),

  // content header
  loadingTop: q("loadingTop"),
  accountTitle: q("accountTitle"),
  accountMeta: q("accountMeta"),
  btnAccountSettings: q("btnAccountSettings"),

  // summary cards
  kSaldo: q("kSaldo"),
  kAbonos: q("kAbonos"),
  kCargos: q("kCargos"),

  // owner panel / tx form
  ownerPanel: q("ownerPanel"),
  txForm: q("txForm"),
  txMovement: q("txMovement"),
  txDate: q("txDate"),
  txAmount: q("txAmount"),
  txCurrency: q("txCurrency"),
  txNote: q("txNote"),
  txMsg: q("txMsg"),

  // tx list
  btnReload: q("btnReload"),
  txLoading: q("txLoading"),
  txBody: q("txBody"),
  txEmpty: q("txEmpty"),

  // dialogs: create account
  dlgAccount: q("dlgAccount"),
  accountForm: q("accountForm"),
  accTitle: q("accTitle"),
  accKind: q("accKind"),
  accCurrency: q("accCurrency"),
  accInitial: q("accInitial"),
  accWeekly: q("accWeekly"),
  accPayTo: q("accPayTo"),
  accNotes: q("accNotes"),
  accViewer: q("accViewer"),
  accMsg: q("accMsg"),

  // dialogs: edit account
  dlgAccountEdit: q("dlgAccountEdit"),
  accountEditForm: q("accountEditForm"),
  eAccTitle: q("eAccTitle"),
  eAccKind: q("eAccKind"),
  eAccCurrency: q("eAccCurrency"),
  eAccWeekly: q("eAccWeekly"),
  eAccPayTo: q("eAccPayTo"),
  eAccNotes: q("eAccNotes"),
  eAccViewer: q("eAccViewer"),
  eAccMsg: q("eAccMsg"),
  btnDeleteAccount: q("btnDeleteAccount"),

  // admin
  dlgAdmin: q("dlgAdmin"),
  adminForm: q("adminForm"),
  admNewUser: q("admNewUser"),
  admRole: q("admRole"),
  btnCreateUser: q("btnCreateUser"),
  btnReloadUsers: q("btnReloadUsers"),
  admMsg: q("admMsg"),
  admUsersBody: q("admUsersBody"),
  admEmpty: q("admEmpty"),

  // temp pass dialog
  dlgTempPass: q("dlgTempPass"),
  tempPassValue: q("tempPassValue"),
  btnCopyTemp: q("btnCopyTemp"),
  tempMsg: q("tempMsg"),
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
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function show(node, text = "", type = "") {
  if (!node) return;
  node.textContent = text;
  node.className = `msg ${type}`.trim();
}

async function api(path, { method = "GET", body } = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  let json = null;
  try { json = await res.json(); } catch {}

  if (!res.ok || !json) throw new Error(json?.error || `HTTP ${res.status}`);
  if (!json.ok) throw new Error(json.error || "Error");
  return json.data;
}

function setView(name) {
  if (name === "login") {
    el.viewLogin?.classList.remove("hidden");
    el.viewApp?.classList.add("hidden");
  } else {
    el.viewLogin?.classList.add("hidden");
    el.viewApp?.classList.remove("hidden");
  }
}

function renderTopbar() {
  el.whoami.textContent = state.me ? `@${state.me.username} · ${state.me.role}` : "";
  el.btnLogout.classList.toggle("hidden", !state.me);
  el.btnAdmin.classList.toggle("hidden", !(state.me && state.me.role === "ADMIN"));
}

function canOwner(acc) {
  return state.me && acc && Number(acc.owner_user_id) === Number(state.me.id);
}

function canViewer(acc) {
  return state.me && acc && acc.viewer_user_id && Number(acc.viewer_user_id) === Number(state.me.id);
}

async function checkMe() {
  try {
    const data = await api("/api/auth/me");
    state.me = data.user;
    return true;
  } catch {
    state.me = null;
    return false;
  }
}

async function loadAccounts() {
  const data = await api("/api/accounts");
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
    renderOwnerPanel();
    return;
  }

  el.txLoading.classList.remove("hidden");
  try {
    const data = await api(`/api/transactions?account_id=${encodeURIComponent(accountId)}`);
    state.transactions = data.transactions || [];
    state.summary = data.summary || { saldo: 0, total_abonos: 0, total_cargos: 0 };
  } finally {
    el.txLoading.classList.add("hidden");
  }

  renderSummary();
  renderTransactions();
  renderOwnerPanel();
}

function renderAccounts() {
  el.accountsList.innerHTML = "";

  if (!state.accounts.length) {
    el.accountsEmpty.classList.remove("hidden");
    return;
  }
  el.accountsEmpty.classList.add("hidden");

  for (const acc of state.accounts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "acc-item";
    if (acc.id === state.selectedAccountId) btn.classList.add("active");

    const badge = document.createElement("span");
    badge.className = `badge ${acc.kind === "PAYABLE" ? "payable" : "receivable"}`;
    badge.textContent = acc.kind === "PAYABLE" ? "Debo" : "Me deben";

    const title = document.createElement("div");
    title.className = "acc-title";
    title.textContent = acc.title;

    const meta = document.createElement("div");
    meta.className = "acc-meta";
    const role = canOwner(acc) ? "OWNER" : "VIEWER";
    meta.textContent = `${role} · ${acc.currency}`;

    btn.appendChild(badge);
    btn.appendChild(title);
    btn.appendChild(meta);

    btn.addEventListener("click", async () => {
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
    el.accountTitle.textContent = "Selecciona una cuenta";
    el.accountMeta.textContent = "";
    el.btnAccountSettings.classList.add("hidden");
    return;
  }

  el.accountTitle.textContent = acc.title;
  const role = canOwner(acc) ? "OWNER" : "VIEWER";
  const viewer = acc.viewer_username ? ` · viewer @${acc.viewer_username}` : "";
  el.accountMeta.textContent = `${role} · ${acc.kind} · ${acc.currency}${viewer}`;
  el.btnAccountSettings.classList.toggle("hidden", !canOwner(acc));
}

function renderSummary() {
  el.kSaldo.textContent = fmtMoney(state.summary.saldo);
  el.kAbonos.textContent = fmtMoney(state.summary.total_abonos);
  el.kCargos.textContent = fmtMoney(state.summary.total_cargos);
}

function renderOwnerPanel() {
  const acc = state.selectedAccount;
  if (!acc || !canOwner(acc)) {
    el.ownerPanel.classList.add("hidden");
    return;
  }
  el.ownerPanel.classList.remove("hidden");
  el.txCurrency.value = acc.currency;
  if (!el.txDate.value) el.txDate.value = todayISO();
}

function renderTransactions() {
  el.txBody.innerHTML = "";

  const acc = state.selectedAccount;
  if (!acc || !state.transactions.length) {
    el.txEmpty.classList.remove("hidden");
    return;
  }
  el.txEmpty.classList.add("hidden");

  for (const tx of state.transactions) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = tx.date;

    const tdType = document.createElement("td");
    tdType.innerHTML = `<span class="pill ${tx.movement === "ABONO" ? "pill-ok" : "pill-warn"}">${tx.movement}</span>`;

    const tdAmt = document.createElement("td");
    tdAmt.textContent = fmtMoney(tx.amount);

    const tdNote = document.createElement("td");
    tdNote.textContent = tx.note || tx.pay_to || "";

    const tdReceipt = document.createElement("td");
    if (tx.movement === "ABONO") {
      const st = tx.receipt_status || "PENDIENTE";
      tdReceipt.innerHTML = `<span class="pill ${st === "RECIBIDO" ? "pill-ok" : "pill-muted"}">${st}</span>`;
    } else {
      tdReceipt.innerHTML = `<span class="pill pill-muted">—</span>`;
    }

    const tdAct = document.createElement("td");
    tdAct.className = "td-actions";

    if (canViewer(acc) && tx.movement === "ABONO" && tx.receipt_status === "PENDIENTE") {
      const b = document.createElement("button");
      b.className = "btn small";
      b.textContent = "Confirmar recibido";
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await api(`/api/transactions/${tx.id}/confirm-receipt`, { method: "POST" });
          await loadTransactions(acc.id);
        } catch (e) {
          alert(e.message);
        } finally {
          b.disabled = false;
        }
      });
      tdAct.appendChild(b);
    } else {
      tdAct.innerHTML = `<span class="muted">—</span>`;
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdType);
    tr.appendChild(tdAmt);
    tr.appendChild(tdNote);
    tr.appendChild(tdReceipt);
    tr.appendChild(tdAct);

    el.txBody.appendChild(tr);
  }
}

/* -------------------- EVENTS -------------------- */

// login
el.loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  show(el.loginMsg, "", "");

  const username = el.loginUsername.value.trim().toLowerCase();
  const password = el.loginPassword.value;

  try {
    await api("/api/auth/login", { method: "POST", body: { username, password } });

    const ok = await checkMe();
    if (!ok) throw new Error("No se pudo validar la sesión");

    setView("app");
    renderTopbar();
    await loadAccounts();
    await loadTransactions(state.selectedAccountId);
  } catch (e) {
    show(el.loginMsg, e.message || "Error", "err");
  }
});

// logout
el.btnLogout.addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  state.me = null;
  state.accounts = [];
  state.transactions = [];
  state.selectedAccountId = null;
  state.selectedAccount = null;
  setView("login");
  renderTopbar();
});

// new account dialog
el.btnNewAccount.addEventListener("click", () => {
  show(el.accMsg, "", "");
  el.accountForm.reset();
  el.accInitial.value = "0";
  el.accCurrency.value = "USD";
  el.dlgAccount.showModal();
});

el.accountForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  show(el.accMsg, "Creando...", "");

  try {
    const viewer = el.accViewer.value.trim().toLowerCase();
    await api("/api/accounts", {
      method: "POST",
      body: {
        title: el.accTitle.value,
        kind: el.accKind.value,
        currency: el.accCurrency.value,
        initial_amount: Number(el.accInitial.value || 0),
        weekly_target: el.accWeekly.value === "" ? null : Number(el.accWeekly.value),
        pay_to: el.accPayTo.value === "" ? null : el.accPayTo.value,
        notes: el.accNotes.value === "" ? null : el.accNotes.value,
        viewer_username: viewer === "" ? null : viewer,
      },
    });

    el.dlgAccount.close();
    await loadAccounts();
    await loadTransactions(state.selectedAccountId);
  } catch (e) {
    show(el.accMsg, e.message || "Error", "err");
  }
});

// edit account dialog
el.btnAccountSettings.addEventListener("click", () => {
  const acc = state.selectedAccount;
  if (!acc) return;

  show(el.eAccMsg, "", "");
  el.eAccTitle.value = acc.title;
  el.eAccKind.value = acc.kind;
  el.eAccCurrency.value = acc.currency;
  el.eAccWeekly.value = acc.weekly_target ?? "";
  el.eAccPayTo.value = acc.pay_to ?? "";
  el.eAccNotes.value = acc.notes ?? "";
  el.eAccViewer.value = acc.viewer_username ?? "";

  el.dlgAccountEdit.showModal();
});

el.accountEditForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const acc = state.selectedAccount;
  if (!acc) return;

  show(el.eAccMsg, "Guardando...", "");

  try {
    const viewer = el.eAccViewer.value.trim().toLowerCase();
    await api(`/api/accounts/${acc.id}`, {
      method: "PUT",
      body: {
        title: el.eAccTitle.value,
        kind: el.eAccKind.value,
        currency: el.eAccCurrency.value,
        weekly_target: el.eAccWeekly.value === "" ? null : Number(el.eAccWeekly.value),
        pay_to: el.eAccPayTo.value === "" ? null : el.eAccPayTo.value,
        notes: el.eAccNotes.value === "" ? null : el.eAccNotes.value,
        viewer_username: viewer === "" ? null : viewer,
      },
    });

    el.dlgAccountEdit.close();
    await loadAccounts();
    state.selectedAccount = state.accounts.find(a => a.id === acc.id) || null;
    renderSelectedAccountHeader();
    await loadTransactions(acc.id);
  } catch (e) {
    show(el.eAccMsg, e.message || "Error", "err");
  }
});

el.btnDeleteAccount.addEventListener("click", async () => {
  const acc = state.selectedAccount;
  if (!acc) return;
  if (!confirm("¿Eliminar esta cuenta? (soft delete)")) return;

  try {
    await api(`/api/accounts/${acc.id}`, { method: "DELETE" });
    el.dlgAccountEdit.close();
    await loadAccounts();
    await loadTransactions(state.selectedAccountId);
  } catch (e) {
    alert(e.message);
  }
});

// create tx
el.txForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const acc = state.selectedAccount;
  if (!acc) return;

  show(el.txMsg, "Guardando...", "");

  try {
    await api("/api/transactions", {
      method: "POST",
      body: {
        account_id: acc.id,
        movement: el.txMovement.value,
        date: el.txDate.value,
        amount: Number(el.txAmount.value),
        currency: el.txCurrency.value,
        note: el.txNote.value === "" ? null : el.txNote.value,
      },
    });

    el.txForm.reset();
    el.txMovement.value = "ABONO";
    el.txDate.value = todayISO();
    el.txCurrency.value = acc.currency;

    show(el.txMsg, "Guardado ✅", "ok");
    setTimeout(() => show(el.txMsg, ""), 1200);

    await loadTransactions(acc.id);
  } catch (e) {
    show(el.txMsg, e.message || "Error", "err");
  }
});

// reload tx
el.btnReload.addEventListener("click", async () => {
  if (!state.selectedAccountId) return;
  await loadTransactions(state.selectedAccountId);
});

// admin open
el.btnAdmin.addEventListener("click", async () => {
  el.dlgAdmin.showModal();
  await loadAdminUsers();
});

async function loadAdminUsers() {
  el.admUsersBody.innerHTML = "";
  el.admEmpty.classList.add("hidden");
  show(el.admMsg, "", "");

  try {
    const data = await api("/api/admin/users");
    const users = data.users || [];

    if (!users.length) {
      el.admEmpty.classList.remove("hidden");
      return;
    }

    for (const u of users) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>@${u.username}</td>
        <td><span class="pill pill-muted">${u.role}</span></td>
        <td><span class="pill ${u.is_active === 1 ? "pill-ok" : "pill-warn"}">${u.is_active === 1 ? "Activo" : "Inactivo"}</span></td>
        <td>${(u.created_at || "").replace("T"," ").slice(0,19)}</td>
        <td class="td-actions">
          <button class="btn secondary small" data-reset="${u.id}">Reset pass</button>
        </td>
      `;
      el.admUsersBody.appendChild(tr);
    }

    el.admUsersBody.querySelectorAll("button[data-reset]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reset");
        btn.disabled = true;
        try {
          const data = await api(`/api/admin/users/${id}/reset-password`, { method: "POST" });
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
  }
}

el.btnReloadUsers.addEventListener("click", loadAdminUsers);

el.btnCreateUser.addEventListener("click", async () => {
  show(el.admMsg, "Creando...", "");
  const username = el.admNewUser.value.trim().toLowerCase();
  const role = el.admRole.value;

  if (username.length < 3) {
    show(el.admMsg, "Username inválido (mín 3).", "err");
    return;
  }

  try {
    const data = await api("/api/admin/users", { method: "POST", body: { username, role } });
    el.admNewUser.value = "";
    show(el.admMsg, "Usuario creado ✅", "ok");
    await loadAdminUsers();
    openTempPassword(data.temp_password);
  } catch (e) {
    show(el.admMsg, e.message || "Error", "err");
  }
});

function openTempPassword(tp) {
  el.tempPassValue.textContent = tp || "";
  show(el.tempMsg, "", "");
  el.dlgTempPass.showModal();
}

el.btnCopyTemp.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.tempPassValue.textContent || "");
    show(el.tempMsg, "Copiado ✅", "ok");
    setTimeout(() => show(el.tempMsg, ""), 1000);
  } catch {
    show(el.tempMsg, "No se pudo copiar", "err");
  }
});

/* -------------------- BOOT -------------------- */
(async function boot() {
  el.txDate.value = todayISO();

  const logged = await checkMe();
  if (!logged) {
    setView("login");
    renderTopbar();
    return;
  }

  setView("app");
  renderTopbar();
  await loadAccounts();
  await loadTransactions(state.selectedAccountId);
})();
