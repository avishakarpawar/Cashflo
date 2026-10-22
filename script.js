 // ---------- Setup ----------
const EXPENSE_CATS = ["Food", "Transport", "Rent", "Bills", "Shopping", "Health", "Fun", "Other"];
const INCOME_CATS = ["Salary", "Other income"];
const COLORS = ["#2c7a58", "#3b7dd8", "#8a5cc2", "#c9822b", "#c94f7c", "#d4513f", "#2aa6a6", "#7c8b86"];
const STORAGE_KEY = "paisa-tracker-v1";

let state = { tx: [], budgets: {} };
let type = "expense";
let editingId = null;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && saved.tx && saved.budgets) state = saved;
} catch (e) {}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const monthKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

const today = new Date().toISOString().slice(0, 10);
$("month").value = today.slice(0, 7);
$("date").value = today;

// ---------- Form ----------
function fillCategories() {
  const list = type === "expense" ? EXPENSE_CATS : INCOME_CATS;
  $("cat").innerHTML = list.map((c) => `<option>${c}</option>`).join("");
}

function setType(t) {
  type = t;
  $("tExp").setAttribute("aria-pressed", t === "expense");
  $("tInc").setAttribute("aria-pressed", t === "income");
  fillCategories();
}

function resetForm() {
  editingId = null;
  $("amount").value = "";
  $("note").value = "";
  $("date").value = today;
  $("formTitle").textContent = "Add a transaction";
  $("add").textContent = "Add transaction";
  $("cancel").hidden = true;
  setType("expense");
}

$("tExp").onclick = () => setType("expense");
$("tInc").onclick = () => setType("income");
$("cancel").onclick = resetForm;

$("add").onclick = () => {
  const amount = parseFloat($("amount").value);
  if (!amount || amount <= 0) { $("err").textContent = "Enter an amount greater than 0."; return; }
  if (!$("date").value) { $("err").textContent = "Pick a date."; return; }
  $("err").textContent = "";

  const entry = { id: editingId || Date.now(), type, amount, cat: $("cat").value, note: $("note").value.trim(), date: $("date").value };
  if (editingId) state.tx = state.tx.map((t) => (t.id === editingId ? entry : t));
  else state.tx.push(entry);

  resetForm();
  save();
  render();
  $("amount").focus();
};

function startEdit(id) {
  const t = state.tx.find((x) => x.id === id);
  if (!t) return;
  editingId = id;
  setType(t.type);
  $("cat").value = t.cat;
  $("amount").value = t.amount;
  $("date").value = t.date;
  $("note").value = t.note;
  $("formTitle").textContent = "Edit transaction";
  $("add").textContent = "Save changes";
  $("cancel").hidden = false;
  $("amount").scrollIntoView({ behavior: "smooth", block: "center" });
  $("amount").focus();
}

// ---------- Filters ----------
$("fCat").innerHTML =
  '<option value="all">All categories</option>' +
  EXPENSE_CATS.concat(INCOME_CATS).map((c) => `<option>${c}</option>`).join("");

// ---------- Data ----------
function monthTransactions() {
  const month = $("month").value;
  return state.tx
    .filter((t) => t.date.slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function filtered(tx) {
  const q = $("q").value.trim().toLowerCase();
  return tx.filter(
    (t) =>
      ($("fType").value === "all" || t.type === $("fType").value) &&
      ($("fCat").value === "all" || t.cat === $("fCat").value) &&
      (!q || t.note.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q))
  );
}

// ---------- Charts ----------
function renderDonut(byCat, spent) {
  const entries = EXPENSE_CATS.map((c, i) => ({ c, v: byCat[c] || 0, color: COLORS[i] })).filter((e) => e.v > 0);
  if (!spent) {
    $("donut").style.background = "var(--line)";
    $("donutCenter").innerHTML = "<span>No spending<small>yet</small></span>";
    $("legend").innerHTML = '<li class="empty">Add an expense to see the breakdown.</li>';
    return;
  }
  let acc = 0;
  const stops = entries.map((e) => {
    const from = (acc / spent) * 100;
    acc += e.v;
    return `${e.color} ${from}% ${(acc / spent) * 100}%`;
  });
  $("donut").style.background = `conic-gradient(${stops.join(",")})`;
  $("donutCenter").innerHTML = `<span>${inr(spent)}<small>spent</small></span>`;
  $("legend").innerHTML = entries
    .sort((a, b) => b.v - a.v)
    .map((e) => `<li><i style="background:${e.color}"></i><span>${e.c}</span><span>${Math.round((e.v / spent) * 100)}% · ${inr(e.v)}</span></li>`)
    .join("");
}

function renderMonths() {
  const [y, m] = $("month").value.split("-").map(Number);
  const data = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = monthKey(d);
    let inc = 0, out = 0;
    state.tx.forEach((t) => {
      if (t.date.slice(0, 7) !== key) return;
      if (t.type === "income") inc += t.amount; else out += t.amount;
    });
    data.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), inc, out, now: i === 0 });
  }
  const max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.out)));
  $("months").innerHTML = data
    .map((d) => `
      <div class="mcol${d.now ? " now" : ""}" title="${d.label}: income ${inr(d.inc)}, spent ${inr(d.out)}">
        <div class="pair"><i class="in" style="height:${(d.inc / max) * 100}%"></i><i class="out" style="height:${(d.out / max) * 100}%"></i></div>
        <small>${d.label}</small>
      </div>`)
    .join("");
}

// ---------- Render ----------
function render() {
  if (!$("month").value) $("month").value = today.slice(0, 7);
  const tx = monthTransactions();
  let income = 0, spent = 0;
  const byCat = {};
  tx.forEach((t) => {
    if (t.type === "income") income += t.amount;
    else { spent += t.amount; byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; }
  });

  const budgeted = EXPENSE_CATS.reduce((sum, c) => sum + (state.budgets[c] || 0), 0);
  const left = income - spent;
  $("left").textContent = (left < 0 ? "−" : "") + inr(Math.abs(left));
  $("left").className = "big" + (left < 0 ? " neg" : "");
  $("inc").textContent = inr(income);
  $("spent").textContent = inr(spent);
  $("bud").textContent = inr(budgeted);

  renderDonut(byCat, spent);
  renderMonths();

  const shown = filtered(tx);
  $("list").innerHTML = shown.length
    ? shown.map((t) => {
        const d = new Date(t.date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const isIncome = t.type === "income";
        return `
          <div class="tx">
            <div class="n">${esc(t.cat)}<span>${d}${t.note ? " – " + esc(t.note) : ""}</span></div>
            <div class="right">
              <span class="amt ${isIncome ? "in" : ""}">${isIncome ? "+" : "−"}${inr(t.amount)}</span>
              <button class="x edit" data-edit="${t.id}" aria-label="Edit transaction">✎</button>
              <button class="x" data-id="${t.id}" aria-label="Delete transaction">×</button>
            </div>
          </div>`;
      }).join("")
    : `<p class="empty">${tx.length ? "No transactions match your filters." : "No transactions this month. Add your first one above."}</p>`;

  $("budgets").innerHTML = EXPENSE_CATS.map((c) => {
    const s = byCat[c] || 0;
    const limit = state.budgets[c] || 0;
    const pct = limit ? Math.min(100, (s / limit) * 100) : 0;
    const level = !limit ? "" : s > limit ? "bad" : s / limit >= 0.8 ? "warn" : "";
    const msg = limit ? (s > limit ? "Over by " + inr(s - limit) : inr(limit - s) + " left") : "No limit set";
    return `
      <div class="b">
        <div class="top"><span>${c}</span><span>${inr(s)}${limit ? " of " + inr(limit) : ""}</span></div>
        <div class="bar"><i class="${level}" style="width:${pct}%"></i></div>
        <div class="lim">
          <span>${msg}</span><span class="push">Limit</span>
          <input type="number" min="0" inputmode="numeric" data-cat="${c}" value="${limit || ""}" aria-label="Monthly limit for ${c}">
        </div>
      </div>`;
  }).join("");
}

// ---------- Events ----------
$("list").onclick = (e) => {
  const edit = e.target.dataset.edit;
  const del = e.target.dataset.id;
  if (edit) return startEdit(Number(edit));
  if (!del) return;
  state.tx = state.tx.filter((t) => String(t.id) !== del);
  if (editingId === Number(del)) resetForm();
  save();
  render();
};

$("budgets").onchange = (e) => {
  const cat = e.target.dataset.cat;
  if (!cat) return;
  const value = parseFloat(e.target.value);
  if (value > 0) state.budgets[cat] = value; else delete state.budgets[cat];
  save();
  render();
};

["q", "fType", "fCat", "month"].forEach((id) => ($(id).oninput = render));

$("export").onclick = () => {
  const rows = ["Date,Type,Category,Amount,Note"].concat(
    monthTransactions().map((t) => [t.date, t.type, t.cat, t.amount, '"' + t.note.replace(/"/g, '""') + '"'].join(","))
  );
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses-" + $("month").value + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ---------- Start ----------
fillCategories();
render();
