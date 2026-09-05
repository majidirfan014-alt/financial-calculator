firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const COLLECTION = 'transactions';

const nameInput = document.getElementById('name');
const dateInput = document.getElementById('date');
const descInput = document.getElementById('desc');
const amountInput = document.getElementById('amount');
const form = document.getElementById('transactionForm');
const historyList = document.getElementById('historyList');
const filterAll = document.getElementById('filterAll');
const filterMajid = document.getElementById('filterMajid');
const filterRatih = document.getElementById('filterRatih');
const filterDate = document.getElementById('filterDate');
const filterClear = document.getElementById('filterClear');

let activeFilter = null;
let activePersonFilter = null;
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

function calcPerson(name) {
    const txns = allTransactions.filter(t => t.name === name);
    let income = 0;
    let expense = 0;
    txns.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    return { income, expense, saldo: income - expense };
}

function updateSummary() {
    const majid = calcPerson('Majid');
    const ratih = calcPerson('Ratih');

    document.getElementById('saldoMajid').textContent = formatCurrency(majid.saldo);
    document.getElementById('incomeMajid').textContent = formatCurrency(majid.income);
    document.getElementById('expenseMajid').textContent = formatCurrency(majid.expense);

    document.getElementById('saldoRatih').textContent = formatCurrency(ratih.saldo);
    document.getElementById('incomeRatih').textContent = formatCurrency(ratih.income);
    document.getElementById('expenseRatih').textContent = formatCurrency(ratih.expense);

    const saldoMajidEl = document.getElementById('saldoMajid');
    const saldoRatihEl = document.getElementById('saldoRatih');
    saldoMajidEl.style.color = majid.saldo < 0 ? '#ef4444' : '#1a1a2e';
    saldoRatihEl.style.color = ratih.saldo < 0 ? '#ef4444' : '#1a1a2e';
}

function renderHistory() {
    let filtered = [...allTransactions];

    if (filtered.length === 0) {
        historyList.innerHTML = '<p class="empty-state">Belum ada transaksi</p>';
        return;
    }

    if (activePersonFilter) {
        filtered = filtered.filter(t => t.name === activePersonFilter);
    }

    if (activeFilter) {
        filtered = filtered.filter(t => t.date === activeFilter);
    }

    if (filtered.length === 0) {
        historyList.innerHTML = '<p class="empty-state">Tidak ada transaksi</p>';
        return;
    }

    const sorted = filtered.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.id - a.id;
    });

    historyList.innerHTML = sorted.map(t => {
        const badgeClass = t.name === 'Majid' ? 'majid' : 'ratih';
        return `
        <div class="history-item ${t.type}">
            <div class="history-icon">${t.type === 'income' ? '↑' : '↓'}</div>
            <div class="history-details">
                <div class="history-desc">${escapeHtml(t.desc)}</div>
                <div class="history-meta">
                    <span class="history-date">${formatDate(t.date)}</span>
                    <span class="history-badge ${badgeClass}">${escapeHtml(t.name)}</span>
                </div>
            </div>
            <span class="history-amount">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
            <button class="history-delete" onclick="deleteTransaction('${t.id}')" title="Hapus">&times;</button>
        </div>`;
    }).join('');
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

    const name = nameInput.value;
    const date = dateInput.value;
    const desc = descInput.value.trim();
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = parseAmount(amountInput.value);

    if (!name || !date || !desc || amount <= 0) {
        alert('Mohon lengkapi semua data dengan benar.');
        return;
    }

    const newTransaction = {
        id: Date.now(),
        name,
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

function clearPersonFilter() {
    activePersonFilter = null;
    filterAll.classList.add('active');
    filterMajid.classList.remove('active');
    filterRatih.classList.remove('active');
}

// Filter events
filterAll.addEventListener('click', function () {
    clearPersonFilter();
    renderHistory();
});

filterMajid.addEventListener('click', function () {
    activePersonFilter = 'Majid';
    filterAll.classList.remove('active');
    filterMajid.classList.add('active');
    filterRatih.classList.remove('active');
    renderHistory();
});

filterRatih.addEventListener('click', function () {
    activePersonFilter = 'Ratih';
    filterAll.classList.remove('active');
    filterMajid.classList.remove('active');
    filterRatih.classList.add('active');
    renderHistory();
});

filterDate.addEventListener('change', function () {
    activeFilter = this.value || null;
    renderHistory();
});

filterClear.addEventListener('click', function () {
    activeFilter = null;
    filterDate.value = '';
    renderHistory();
});

// Init
setDefaultDate();
loadTransactions();
