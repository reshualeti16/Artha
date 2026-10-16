
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "artha_transactions_v1";
const BUDGET_KEY = "artha_budget_v1";

const colors = [
  "#204b3c", "#c7a45c", "#7ca58b", "#d18b75",
  "#8196b0", "#a58ab5", "#d3b5a1", "#9da98d", "#b4b9b0"
];

const categories = [
  "Food", "Transport", "Education", "Shopping",
  "Entertainment", "Health", "Bills", "Pocket Money",
  "Salary", "Other"
];

const icons = {
  Food: "☕",
  Travel: "↗",
  Transport: "↗",
  Shopping: "◇",
  Education: "▤",
  Entertainment: "♫",
  Health: "+",
  Bills: "▤",
  Salary: "₹",
  "Pocket Money": "✳",
  Other: "○"
};

function currentDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      const data = JSON.parse(saved);
      if (!Array.isArray(data)) return [];

      return data.filter((item) =>
        item &&
        typeof item.title === "string" &&
        Number.isFinite(Number(item.amount)) &&
        Number(item.amount) > 0 &&
        ["income", "expense"].includes(item.type) &&
        typeof item.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date)
      ).map((item) => ({
        ...item,
        id: Number(item.id) || Date.now(),
        amount: Number(item.amount),
        category: String(item.category || "Other")
      }));
    }
  } catch (error) {
    console.error("Could not load transactions:", error);
  }

  return [
    {
      id: 1, title: "Monthly pocket money", amount: 15000,
      type: "income", category: "Pocket Money", date: daysAgo(4)
    },
    {
      id: 2, title: "College canteen", amount: 180,
      type: "expense", category: "Food", date: daysAgo(3)
    },
    {
      id: 3, title: "Bus pass", amount: 650,
      type: "expense", category: "Transport", date: daysAgo(2)
    },
    {
      id: 4, title: "Study materials", amount: 420,
      type: "expense", category: "Education", date: daysAgo(1)
    },
    {
      id: 5, title: "Snacks with friends", amount: 160,
      type: "expense", category: "Food", date: currentDate()
    }
  ];
}

let transactions = loadTransactions();
let monthlyBudget = 10000;
let spendingChart = null;
let toastTimer;

try {
  const savedBudget = Number(localStorage.getItem(BUDGET_KEY));
  if (Number.isFinite(savedBudget) && savedBudget > 0) {
    monthlyBudget = savedBudget;
  }
} catch (error) {
  console.error("Could not load budget:", error);
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error("Could not save transactions:", error);
    showToast("Could not save data. Check browser storage.");
    return false;
  }
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function isThisMonth(dateString) {
  const date = new Date(dateString + "T12:00:00");
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth();
}

function dateLabel(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString(
    "en-IN", { day: "numeric", month: "short", year: "numeric" }
  );
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* DASHBOARD */

function renderDashboard() {
  const monthly = transactions.filter((item) => isThisMonth(item.date));

  const income = monthly
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expenses = monthly
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const balance = transactions.reduce((sum, item) =>
    sum + (item.type === "income" ? item.amount : -item.amount), 0);

  $("totalBalance").textContent = money(balance);
  $("totalIncome").textContent = money(income);
  $("totalExpenses").textContent = money(expenses);
  $("budgetSpent").textContent = money(expenses);
  $("budgetLimit").textContent = money(monthlyBudget);
  $("budgetInput").value = monthlyBudget;

  const percent = (expenses / monthlyBudget) * 100;
  $("budgetProgressFill").style.width = Math.min(percent, 100) + "%";
  $("budgetProgressFill").classList.toggle("over", percent >= 100);
  $("budgetProgress").setAttribute("aria-valuenow", String(Math.round(percent)));

  if (percent >= 100) {
    $("budgetMessage").textContent =
      "Budget exceeded by " + money(expenses - monthlyBudget) +
      ". Review your spending.";
  } else if (percent >= 75) {
    $("budgetMessage").textContent =
      Math.round(percent) + "% of your budget used. Spend carefully!";
  } else {
    $("budgetMessage").textContent =
      money(monthlyBudget - expenses) + " left to spend this month.";
  }

  renderTransactions();
  renderChart();
  renderInsights();
}

/* TRANSACTIONS */

function renderTransactions() {
  const filter = $("transactionFilter").value;
  const filtered = transactions
    .filter((item) => filter === "all" || item.type === filter)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  $("transactionBody").innerHTML = filtered.map((item) => {
    const typeLabel = item.type === "income" ? "Income" : "Expense";
    const amountClass = item.type === "income" ? "amount-income" : "amount-expense";
    const sign = item.type === "income" ? "+" : "−";
    const iconClass = item.type === "income" ? "income" : "expense";
    const icon = icons[item.category] || icons.Other;

    return `
      <tr>
        <td><div class="transaction-name">
          <span class="transaction-icon ${iconClass}">${icon}</span>
          <span>${escapeHTML(item.title)}
            <span class="transaction-subtitle">${typeLabel}</span>
          </span>
        </div></td>
        <td><span class="category-pill">${escapeHTML(item.category)}</span></td>
        <td>${dateLabel(item.date)}</td>
        <td class="${amountClass}">${sign}${money(item.amount)}</td>
        <td><button class="delete-btn" data-delete="${item.id}"
          aria-label="Delete ${escapeHTML(item.title)}"
          title="Delete transaction" type="button">×</button></td>
      </tr>`;
  }).join("");

  $("emptyState").hidden = filtered.length !== 0;
  $("transactionTable").hidden = filtered.length === 0;
}

/* SPENDING CHART */

function renderChart() {
  const expenses = transactions.filter((item) =>
    item.type === "expense" && isThisMonth(item.date));

  const totals = {};
  expenses.forEach((item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
  });

  const names = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  $("chartEmpty").hidden = names.length > 0;
  $("chartEmpty").textContent = "Add expenses to see your breakdown.";

  $("categoryLegend").innerHTML = names.map((name, index) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[index % colors.length]}"></span>
      ${escapeHTML(name)} · ${money(totals[name])}
    </div>`).join("");

  if (spendingChart) {
    spendingChart.destroy();
    spendingChart = null;
  }

  if (typeof Chart === "undefined") {
    $("chartEmpty").textContent = "Chart unavailable. Check your internet connection.";
    $("chartEmpty").hidden = false;
    return;
  }

  spendingChart = new Chart($("spendingChart"), {
    type: "doughnut",
    data: {
      labels: names,
      datasets: [{
        data: names.map((name) => totals[name]),
        backgroundColor: names.map((_, i) => colors[i % colors.length]),
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "69%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => " " + context.label + ": " + money(context.raw)
          }
        }
      }
    }
  });
}

/* SMART FINANCE INSIGHTS */

function renderInsights() {
  const monthly = transactions.filter((item) => isThisMonth(item.date));
  const expenses = monthly.filter((item) => item.type === "expense");
  const income = monthly.filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const savings = income - totalExpenses;
  const used = totalExpenses / monthlyBudget * 100;
  const totals = {};

  expenses.forEach((item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
  });

  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const insights = [];

  if (ranked.length) {
    const [category, amount] = ranked[0];
    const share = totalExpenses ? Math.round(amount / totalExpenses * 100) : 0;
    insights.push({
      icon: "📊", style: "", title: "Your biggest spending category",
      message: category + " accounts for " + money(amount) +
        " this month (" + share + "% of expenses)."
    });
  } else {
    insights.push({
      icon: "🧾", style: "", title: "Start tracking your spending",
      message: "Add expenses to discover your biggest spending categories."
    });
  }

  if (used >= 100) {
    insights.push({
      icon: "🚨", style: "danger", title: "Budget exceeded",
      message: "You have exceeded your budget by " +
        money(totalExpenses - monthlyBudget) + ". Review non-essential spending."
    });
  } else {
    insights.push({
      icon: used >= 75 ? "⚠️" : "🎯",
      style: used >= 75 ? "warning" : "",
      title: used >= 75 ? "Approaching your budget limit" : "Your budget status",
      message: Math.round(used) + "% of your monthly budget is used. " +
        money(Math.max(0, monthlyBudget - totalExpenses)) + " remains."
    });
  }

  if (income === 0 && totalExpenses === 0) {
    insights.push({
      icon: "💰", style: "", title: "Your savings snapshot",
      message: "Record income and expenses to calculate monthly savings."
    });
  } else if (savings > 0) {
    insights.push({
      icon: "🌱", style: "", title: "Money left after expenses",
      message: "Recorded income exceeds expenses by " + money(savings) +
        (income > 0 ? " (" + Math.round(savings / income * 100) +
        "% of income)." : ".")
    });
  } else {
    insights.push({
      icon: savings < 0 ? "📉" : "⚖️",
      style: savings < 0 ? "danger" : "warning",
      title: savings < 0 ? "Expenses exceed income" : "Income and expenses are equal",
      message: savings < 0
        ? "Expenses exceed recorded income by " + money(Math.abs(savings)) + "."
        : "Your recorded income matches your expenses this month."
    });
  }

  if (expenses.length) {
    insights.push({
      icon: "🧮", style: "", title: "Average expense",
      message: "Your average expense is " + money(totalExpenses / expenses.length) +
        " across " + expenses.length + " transaction(s) this month."
    });
  } else {
    insights.push({
      icon: "✨", style: "", title: "Build a money habit",
      message: "Record everyday expenses for more useful insights."
    });
  }

  $("insightsList").innerHTML = insights.map((item) => `
    <article class="insight-card">
      <span class="insight-icon ${item.style}">${item.icon}</span>
      <div class="insight-copy">
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.message)}</p>
      </div>
    </article>`).join("");
}

/* ADD TRANSACTION MODAL */

function openModal() {
  $("transactionForm").reset();
  $("transactionDate").value = currentDate();
  $("formError").textContent = "";
  $("transactionModal").hidden = false;
  $("transactionTitle").focus();
}

function closeModal() {
  $("transactionModal").hidden = true;
}

$("addTransactionBtn").addEventListener("click", openModal);
$("closeModalBtn").addEventListener("click", closeModal);

$("transactionModal").addEventListener("click", (event) => {
  if (event.target === $("transactionModal")) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("transactionModal").hidden) closeModal();
});

$("transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("transactionTitle").value.trim();
  const amount = Number($("transactionAmount").value);
  const type = $("transactionType").value;
  const category = $("transactionCategory").value;
  const date = $("transactionDate").value;

  if (!title || !Number.isFinite(amount) || amount <= 0 || !date ||
      !["income", "expense"].includes(type)) {
    $("formError").textContent = "Enter a valid name, amount, type and date.";
    return;
  }

  if (!validDate(date) || date > currentDate()) {
    $("formError").textContent = "Choose a valid date that is today or earlier.";
    return;
  }

  const transaction = { id: Date.now(), title, amount, type, category, date };
  transactions.push(transaction);

  if (!saveTransactions()) {
    transactions.pop();
    return;
  }

  renderDashboard();
  closeModal();
  showToast("Transaction added successfully!");
});

/* DELETE TRANSACTION */

$("transactionBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = Number(button.dataset.delete);
  const index = transactions.findIndex((item) => item.id === id);
  if (index === -1) return;

  const removed = transactions.splice(index, 1)[0];
  if (!saveTransactions()) {
    transactions.splice(index, 0, removed);
    return;
  }

  renderDashboard();
  showToast("Transaction deleted.");
});

/* UPDATE MONTHLY BUDGET */

$("budgetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("budgetInput").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a valid budget greater than zero.");
    return;
  }

  try {
    localStorage.setItem(BUDGET_KEY, String(amount));
  } catch (error) {
    showToast("Could not save the budget in your browser.");
    return;
  }

  monthlyBudget = amount;
  renderDashboard();
  showToast("Monthly budget updated!");
});

$("transactionFilter").addEventListener("change", renderTransactions);

/* SIDEBAR NAVIGATION */

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) =>
      item.classList.remove("active"));
    link.classList.add("active");
  });
});

/* =====================================
   IMPORT DATA
===================================== */

let importRows = [];
let importHeaders = [];
let importSourceName = "";

const fieldIds = {
  title: "mapTitle",
  amount: "mapAmount",
  type: "mapType",
  category: "mapCategory",
  date: "mapDate"
};

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  return date.getFullYear() === parts[0] &&
    date.getMonth() === parts[1] - 1 &&
    date.getDate() === parts[2];
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function suggestColumn(field) {
  const aliases = {
    title: ["title", "name", "description", "transaction", "merchant", "details", "particulars", "narration"],
    amount: ["amount", "value", "total", "transactionamount", "debitamount", "creditamount"],
    type: ["type", "transactiontype", "incomeexpense", "kind"],
    category: ["category", "expensecategory", "group"],
    date: ["date", "transactiondate", "datetime", "posteddate"]
  };

  return importHeaders.findIndex((header) =>
    aliases[field].includes(normalizeHeader(header)));
}

function setImportStatus(message, isError = false) {
  const status = $("importStatus");
  status.textContent = message;
  status.style.color = isError ? "#c65b53" : "#39794d";
}

function clearImportPreview() {
  importRows = [];
  importHeaders = [];
  importSourceName = "";
  $("importMappingArea").hidden = true;
  $("importPreviewHead").innerHTML = "";
  $("importPreviewBody").innerHTML = "";
  $("importValidation").textContent = "";
  $("importRowCount").textContent = "0 rows";
  $("confirmImportBtn").disabled = false;
}

function showMappingOptions() {
  Object.entries(fieldIds).forEach(([field, id]) => {
    const select = $(id);
    select.innerHTML = '<option value="">— Not mapped —</option>' +
      importHeaders.map((header, index) =>
        `<option value="${index}">${escapeHTML(header)}</option>`).join("");

    const suggested = suggestColumn(field);
    if (suggested >= 0) select.value = String(suggested);
  });

  $("importMappingArea").hidden = false;
  renderImportPreview();
}

function renderImportPreview() {
  const sample = importRows.slice(0, 6);

  $("importPreviewHead").innerHTML = "<tr>" +
    importHeaders.map((header) => `<th>${escapeHTML(header)}</th>`).join("") +
    "</tr>";

  $("importPreviewBody").innerHTML = sample.map((row) =>
    "<tr>" + importHeaders.map((header) =>
      `<td>${escapeHTML(row[header] ?? "")}</td>`).join("") + "</tr>"
  ).join("");

  $("importRowCount").textContent =
    importRows.length + (importRows.length === 1 ? " row" : " rows");

  updateImportValidation();
}

function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.abs(value) : NaN;
  }

  let cleaned = String(value ?? "").trim();
  if (!cleaned) return NaN;

  const negativeByBrackets = /^\(.*\)$/.test(cleaned);
  cleaned = cleaned.replace(/[₹$€£,\s]/g, "").replace(/[()]/g, "");

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;

  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.abs(number) : NaN;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0")
    ].join("-");
  }

  if (typeof value === "number" && window.XLSX) {
    const converted = XLSX.SSF.parse_date_code(value);
    if (converted) {
      return [
        converted.y,
        String(converted.m).padStart(2, "0"),
        String(converted.d).padStart(2, "0")
      ].join("-");
    }
  }

  const text = String(value ?? "").trim();
  if (!text) return "";

  if (validDate(text)) return text;

  let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    // Ambiguous numeric dates are interpreted as DD/MM/YYYY (Indian format).
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return validDate(result) ? result : "";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0")
  ].join("-");
}

function classifyType(value, amountValue) {
  const text = String(value ?? "").trim().toLowerCase();

  if (["income", "credit", "deposit", "received", "salary"].includes(text)) {
    return "income";
  }
  if (["expense", "debit", "withdrawal", "payment", "spent"].includes(text)) {
    return "expense";
  }

  if (amountValue !== undefined && amountValue !== null && String(amountValue).trim()) {
    const original = String(amountValue).trim();
    if (original.startsWith("-") || /^\(.*\)$/.test(original)) return "expense";
  }

  return "";
}

function normalizeCategory(value, type) {
  const text = String(value ?? "").trim().toLowerCase();

  const match = categories.find((category) =>
    category.toLowerCase() === text);

  if (match) return match;

  const aliases = {
    groceries: "Food",
    restaurant: "Food",
    dining: "Food",
    travel: "Transport",
    fuel: "Transport",
    bus: "Transport",
    school: "Education",
    college: "Education",
    books: "Education",
    medical: "Health",
    healthcare: "Health",
    utilities: "Bills",
    rent: "Bills",
    wages: "Salary",
    salary: "Salary",
    allowance: "Pocket Money"
  };

  return aliases[text] || (type === "income" ? "Other" : "Other");
}

function getMappedTransactions() {
  const column = {};

  Object.entries(fieldIds).forEach(([field, id]) => {
    const value = $(id).value;
    column[field] = value === "" ? -1 : Number(value);
  });

  if (column.title < 0 || column.amount < 0 || column.date < 0) {
    return {
      records: [],
      errors: ["Map at least the transaction name, amount and date columns."]
    };
  }

  const records = [];
  const errors = [];

  importRows.forEach((row, index) => {
    const rawTitle = row[importHeaders[column.title]];
    const rawAmount = row[importHeaders[column.amount]];
    const rawDate = row[importHeaders[column.date]];
    const rawType = column.type >= 0 ? row[importHeaders[column.type]] : "";
    const rawCategory = column.category >= 0 ? row[importHeaders[column.category]] : "";

    const title = String(rawTitle ?? "").trim();
    const amount = parseAmount(rawAmount);
    const date = parseDate(rawDate);

    if (!title && (rawAmount == null || String(rawAmount).trim() === "") &&
        !String(rawDate ?? "").trim()) {
      return;
    }

    if (!title) {
      errors.push(`Row ${index + 2}: missing transaction name.`);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Row ${index + 2}: invalid or missing amount.`);
      return;
    }

    if (!date || !validDate(date)) {
      errors.push(`Row ${index + 2}: invalid date.`);
      return;
    }

    if (date > currentDate()) {
      errors.push(`Row ${index + 2}: future dates are not allowed.`);
      return;
    }

    let type = classifyType(rawType, rawAmount);
    if (!type) {
      // Never guess whether an unsigned amount is income or expense.
      errors.push(`Row ${index + 2}: map a type column or correct the transaction type.`);
      return;
    }

    records.push({
      id: 0,
      title: title.slice(0, 80),
      amount,
      type,
      category: normalizeCategory(rawCategory, type),
      date
    });
  });

  return { records, errors };
}

function updateImportValidation() {
  const result = getMappedTransactions();
  const validCount = result.records.length;
  const errorCount = result.errors.length;

  let message = `${validCount} valid transaction(s) detected.`;
  if (errorCount) {
    message += ` ${errorCount} row(s) need attention. First issue: ${result.errors[0]}`;
  } else if (!validCount) {
    message = "No valid transactions found. Check your column mapping and file.";
  }

  $("importValidation").textContent = message;
  $("confirmImportBtn").disabled = validCount === 0 || errorCount > 0;
}

Object.values(fieldIds).forEach((id) => {
  $(id).addEventListener("change", updateImportValidation);
});

async function readImportFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const text = await file.text();

  if (extension === "csv") {
    if (typeof Papa === "undefined") {
      throw new Error("CSV reader failed to load. Check your internet connection.");
    }

    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim()
    });

    if (result.errors.length) {
      console.warn("CSV parsing warnings:", result.errors);
    }

    return result.data;
  }

  if (extension === "xlsx" || extension === "xls") {
    if (typeof XLSX === "undefined") {
      throw new Error("Excel reader failed to load. Check your internet connection.");
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("No worksheet was found in the Excel file.");

    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  }

  if (extension === "json") {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;

    if (data && Array.isArray(data.transactions)) return data.transactions;
    if (data && Array.isArray(data.data)) return data.data;

    throw new Error("JSON must contain an array of transaction objects.");
  }

  if (extension === "txt") {
    if (typeof Papa === "undefined") {
      throw new Error("Text reader failed to load. Check your internet connection.");
    }

    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: ""
    });

    if (!result.data.length || !Object.keys(result.data[0]).length) {
      throw new Error("TXT format not recognised. Try tab-separated or comma-separated columns.");
    }

    return result.data;
  }

  if (extension === "pdf") {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("PDF reader failed to load. Check your internet connection.");
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      let currentY = null;
      let currentLine = [];

      content.items.forEach((item) => {
        if (!item.str || !item.str.trim()) return;
        const y = Math.round(item.transform[5]);

        if (currentY !== null && Math.abs(y - currentY) > 4) {
          lines.push(currentLine.join("\t"));
          currentLine = [];
        }

        currentY = y;
        currentLine.push(item.str.trim());
      });

      if (currentLine.length) lines.push(currentLine.join("\t"));
    }

    const tableLines = lines.filter((line) => line.includes("\t"));
    if (tableLines.length < 2) {
      throw new Error("No reliable table could be extracted from this PDF. Try exporting it as CSV or Excel.");
    }

    const result = Papa.parse(tableLines.join("\n"), {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true
    });

    if (!result.data.length || !Object.keys(result.data[0]).length) {
      throw new Error("Could not identify a transaction table in this PDF.");
    }

    return result.data;
  }

  throw new Error("Unsupported file type. Please select CSV, Excel, JSON, TXT or PDF.");
}

$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  clearImportPreview();
  setImportStatus("Reading " + file.name + "...");

  try {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Please use a file smaller than 10 MB.");
    }

    const rows = await readImportFile(file);
    if (!rows.length) throw new Error("No rows were found in this file.");

    const headers = Object.keys(rows[0] || {});
    if (!headers.length) {
      throw new Error("Could not identify columns. Check the file format.");
    }

    if (rows.length > 5000) {
      throw new Error("This file contains more than 5,000 rows. Please split it into smaller files.");
    }

    importHeaders = headers;
    importRows = rows.filter((row) => row && typeof row === "object");
    importSourceName = file.name;

    showMappingOptions();
    setImportStatus(`Loaded ${importRows.length} row(s) from ${file.name}. Review the mapping before importing.`);
  } catch (error) {
    console.error("Import error:", error);
    setImportStatus(error.message || "Could not read this file.", true);
    clearImportPreview();
  }
});

$("cancelImportBtn").addEventListener("click", () => {
  clearImportPreview();
  $("importFile").value = "";
  setImportStatus("Import cancelled.");
});

$("confirmImportBtn").addEventListener("click", () => {
  const result = getMappedTransactions();

  if (!result.records.length || result.errors.length) {
    updateImportValidation();
    showToast("Please fix the invalid rows before importing.");
    return;
  }

  const existing = new Set(transactions.map((item) =>
    [item.title.toLowerCase(), item.amount, item.type, item.category, item.date].join("|")
  ));

  const unique = result.records.filter((item) =>
    !existing.has([item.title.toLowerCase(), item.amount, item.type, item.category, item.date].join("|"))
  );

  const duplicates = result.records.length - unique.length;

  if (!unique.length) {
    showToast("All imported records already exist.");
    setImportStatus("No new transactions were added because all rows matched existing transactions.");
    return;
  }

  const startId = Date.now();
  const newTransactions = unique.map((item, index) => ({
    ...item,
    id: startId + index
  }));

  const previous = transactions.slice();
  transactions = transactions.concat(newTransactions);

  if (!saveTransactions()) {
    transactions = previous;
    return;
  }

  renderDashboard();
  clearImportPreview();
  $("importFile").value = "";

  const message = `Imported ${newTransactions.length} transaction(s)` +
    (duplicates ? `; skipped ${duplicates} duplicate(s).` : ".");
  setImportStatus(message);
  showToast(`Successfully imported ${newTransactions.length} transaction(s)!`);
});

/* INITIALISE */

try {
  if (localStorage.getItem(STORAGE_KEY) === null) saveTransactions();
} catch (error) {
  console.error("Browser storage is unavailable:", error);
}

renderDashboard();
