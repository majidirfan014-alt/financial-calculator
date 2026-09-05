firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const COLLECTION = 'transactions';

const dateInput = document.getElementById('date');
const descInput = document.getElementById('desc');
const amountInput = document.getElementById('amount');
const form = document.getElementById('transactionForm');
const historyList = document.getElementById('historyList');
const saldoEl = document.getElementById('saldo');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const filterAll = document.getElementById('filterAll');
const filterDate = document.getElementById('filterDate');
const filterClear = document.getElementById('filterClear');

let activeFilter = null;
let allTransactions = [];

function formatCurrency(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function setDefaultDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
}

function updateSummary() {
    let totalIncome = 0;
    let totalExpense = 0;

    allTransactions.forEach(t => {
        if (t.type === 'income') {
            totalIncome += t.amount;
        } else {
            totalExpense += t.amount;
        }
    });

    const saldo = totalIncome - totalExpense;

    saldoEl.textContent = formatCurrency(saldo);
    totalIncomeEl.textContent = formatCurrency(totalIncome);
    totalExpenseEl.textContent = formatCurrency(totalExpense);

    if (saldo < 0) {
        saldoEl.style.color = '#ef4444';
    } else {
        saldoEl.style.color = '#1a1a2e';
    }
}

function renderHistory() {
    let filtered = [...allTransactions];

    if (filtered.length === 0) {
        historyList.innerHTML = '<p class="empty-state">Belum ada transaksi</p>';
        return;
    }

    if (activeFilter) {
        filtered = filtered.filter(t => t.date === activeFilter);
    }

    if (filtered.length === 0) {
        historyList.innerHTML = '<p class="empty-state">Tidak ada transaksi pada tanggal ini</p>';
        return;
    }

    const sorted = filtered.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.id - a.id;
    });

    historyList.innerHTML = sorted.map(t => `
        <div class="history-item ${t.type}">
            <div class="history-icon">${t.type === 'income' ? '↑' : '↓'}</div>
            <div class="history-details">
                <div class="history-desc">${escapeHtml(t.desc)}</div>
                <div class="history-date">${formatDate(t.date)}</div>
            </div>
            <span class="history-amount">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
            <button class="history-delete" onclick="deleteTransaction('${t.id}')" title="Hapus">&times;</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseAmount(str) {
    const cleaned = str.replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
}

amountInput.addEventListener('input', function () {
    const raw = parseAmount(this.value);
    if (raw > 0) {
        this.value = raw.toLocaleString('id-ID');
    } else {
        this.value = '';
    }
});

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const date = dateInput.value;
    const desc = descInput.value.trim();
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = parseAmount(amountInput.value);

    if (!date || !desc || amount <= 0) {
        alert('Mohon lengkapi semua data dengan benar.');
        return;
    }

    const newTransaction = {
        id: Date.now(),
        date,
        desc,
        type,
        amount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection(COLLECTION).add(newTransaction);
        form.reset();
        setDefaultDate();
        await loadTransactions();
    } catch (err) {
        alert('Gagal menyimpan: ' + err.message);
    }
});

async function deleteTransaction(id) {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
        const snapshot = await db.collection(COLLECTION).where('id', '==', Number(id)).get();
        snapshot.forEach(doc => doc.ref.delete());
        await loadTransactions();
    } catch (err) {
        alert('Gagal menghapus: ' + err.message);
    }
}

async function loadTransactions() {
    try {
        const snapshot = await db.collection(COLLECTION).get();
        allTransactions = [];
        snapshot.forEach(doc => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });
        updateSummary();
        renderHistory();
    } catch (err) {
        historyList.innerHTML = '<p class="empty-state">Gagal memuat data</p>';
    }
}

// Filter events
filterAll.addEventListener('click', function () {
    activeFilter = null;
    filterDate.value = '';
    filterDate.classList.remove('active');
    filterAll.classList.add('active');
    renderHistory();
});

filterDate.addEventListener('change', function () {
    if (this.value) {
        activeFilter = this.value;
        filterAll.classList.remove('active');
        this.classList.add('active');
    }
    renderHistory();
});

filterClear.addEventListener('click', function () {
    activeFilter = null;
    filterDate.value = '';
    filterDate.classList.remove('active');
    filterAll.classList.add('active');
    renderHistory();
});

// Init
setDefaultDate();
loadTransactions();
