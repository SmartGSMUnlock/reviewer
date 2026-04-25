import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, updateDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let allTransactions = [];
let chartInstance = null;
let notifEnabled = false;
let editDocId = null;
let editDocType = null;

// AUTH CHECK
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location = 'login.html';
        return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role!== 'admin') {
        window.location = 'staff-dashboard.html';
        return;
    }
    currentUser = {...user,...userDoc.data() };
    document.getElementById('userBadge').textContent = userDoc.data().fullName;
    initDashboard();
});

// INIT
function initDashboard() {
    const now = new Date();
    document.getElementById('saleDate').value = formatDateTimeLocal(now);
    document.getElementById('repairDate').value = formatDateTimeLocal(now);
    document.getElementById('expenseDate').value = formatDateTimeLocal(now);
    document.getElementById('selectDate').value = now.toISOString().split('T')[0];
    document.getElementById('filterDate').value = now.toISOString().split('T')[0];
    document.getElementById('chartMonth').value = now.toISOString().slice(0, 7);

    loadDashboardStats();
    loadTransactions();
    loadStaff();
    requestNotifPermission();
    registerServiceWorker();
}

// SIDEBAR
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('expanded');
}

window.showSection = function(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(section + '-section').classList.add('active');
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    if (window.innerWidth < 768) toggleSidebar();
}

// THEME
window.toggleTheme = function() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'dark'? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('themeIcon').className = newTheme === 'dark'? 'fas fa-sun' : 'fas fa-moon';
}

window.changeTheme = function() {
    const theme = document.getElementById('themePicker').value;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// NOTIFICATIONS
window.toggleNotif = async function() {
    const btn = document.getElementById('notifBtn');
    if (!notifEnabled) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            notifEnabled = true;
            btn.classList.add('active');
            new Notification('Notifications Enabled', { body: 'You will receive sales alerts from staff', icon: '/icon.png' });
        }
    } else {
        notifEnabled = false;
        btn.classList.remove('active');
    }
}

async function requestNotifPermission() {
    if (Notification.permission === 'granted') {
        notifEnabled = true;
        document.getElementById('notifBtn').classList.add('active');
    }
}

function sendNotif(title, body) {
    if (notifEnabled && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon.png', badge: '/icon.png' });
    }
}

// PWA INSTALL
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBtn').style.display = 'flex';
});

window.installPWA = async function() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('installBtn').style.display = 'none';
    }
}

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/service-worker.js');
        } catch (e) {
            console.log('SW failed:', e);
        }
    }
}

// DASHBOARD STATS - ORDER: REVENUE, PROFIT, CAPITAL, EXPENSES, SALES, REPAIRS
async function loadDashboardStats() {
    const filter = document.getElementById('dateFilter').value;
    const date = document.getElementById('selectDate').value;
    const startDate = getStartDate(filter, date);
    const endDate = getEndDate(filter, date);

    const q = query(
        collection(db, 'transactions'),
        where('ownerUid', '==', currentUser.uid),
        where('timestamp', '>=', startDate),
        where('timestamp', '<=', endDate)
    );

    onSnapshot(q, (snapshot) => {
        let revenue = 0, expenses = 0, capital = 0, salesCount = 0, repairsCount = 0;
        let salesQty = 0, repairsQty = 0;
        allTransactions = [];

        snapshot.forEach(doc => {
            const d = doc.data();
            allTransactions.push({ id: doc.id,...d });

            if (d.type === 'sale') {
                revenue += d.sellPrice * d.qty;
                capital += d.capitalCost * d.qty;
                salesCount++;
                salesQty += d.qty;
            } else if (d.type === 'repair') {
                revenue += d.servicePrice;
                capital += d.partsCapital;
                repairsCount++;
                repairsQty++;
            } else if (d.type === 'expense') {
                expenses += d.amount;
            }
        });

        const profit = revenue - expenses - capital;
        document.getElementById('revenueToday').textContent = '₱' + revenue.toLocaleString('en-PH', {minimumFractionDigits: 2});
        document.getElementById('profitToday').textContent = '₱' + profit.toLocaleString('en-PH', {minimumFractionDigits: 2});
        document.getElementById('capitalToday').textContent = '₱' + capital.toLocaleString('en-PH', {minimumFractionDigits: 2});
        document.getElementById('expensesToday').textContent = '₱' + expenses.toLocaleString('en-PH', {minimumFractionDigits: 2});
        document.getElementById('salesToday').textContent = salesCount;
        document.getElementById('salesQty').textContent = `Quantity: ${salesQty} Items`;
        document.getElementById('repairsToday').textContent = repairsCount;
        document.getElementById('repairsQty').textContent = `Quantity: ${repairsQty} Items`;

        const subText = filter === 'daily'? 'Today' : filter === 'monthly'? 'This Month' : 'This Year';
        document.getElementById('revenueSub').textContent = subText;
    });
}

window.filterDashboard = loadDashboardStats;

// RECORD SALE
window.recordSale = async function() {
    const data = {
        type: 'sale',
        ownerUid: currentUser.uid,
        staffUid: currentUser.uid,
        staffName: currentUser.fullName,
        date: document.getElementById('saleDate').value,
        itemName: document.getElementById('itemName').value,
        brand: document.getElementById('brand').value,
        variant: document.getElementById('variant').value,
        qty: parseInt(document.getElementById('qty').value),
        capitalCost: parseFloat(document.getElementById('capitalCost').value) || 0,
        sellPrice: parseFloat(document.getElementById('sellPrice').value) || 0,
        status: document.getElementById('saleStatus').value,
        warranty: document.getElementById('warranty').value,
        timestamp: serverTimestamp(),
        profit: (parseFloat(document.getElementById('sellPrice').value) - parseFloat(document.getElementById('capitalCost').value || 0)) * parseInt(document.getElementById('qty').value)
    };

    if (!data.itemName ||!data.sellPrice) {
        alert('Please fill item name and selling price');
        return;
    }

    await addDoc(collection(db, 'transactions'), data);
    sendNotif('New Sale Recorded', `${data.itemName} - ₱${data.sellPrice}`);
    alert('Sale recorded successfully!');
    clearSaleForm();
}

// RECORD REPAIR
window.recordRepair = async function() {
    const data = {
        type: 'repair',
        ownerUid: currentUser.uid,
        staffUid: currentUser.uid,
        staffName: currentUser.fullName,
        date: document.getElementById('repairDate').value,
        customerName: document.getElementById('customerName').value,
        brand: document.getElementById('repairBrand').value,
        model: document.getElementById('repairModel').value,
        issueJob: document.getElementById('issueJob').value,
        partsCapital: parseFloat(document.getElementById('partsCapital').value) || 0,
        servicePrice: parseFloat(document.getElementById('servicePrice').value) || 0,
        status: document.getElementById('repairStatus').value,
        warranty: document.getElementById('repairWarranty').value,
        timestamp: serverTimestamp(),
        profit: parseFloat(document.getElementById('servicePrice').value) - parseFloat(document.getElementById('partsCapital').value || 0)
    };

    if (!data.customerName ||!data.servicePrice) {
        alert('Please fill customer name and service price');
        return;
    }

    await addDoc(collection(db, 'transactions'), data);
    sendNotif('New Repair Recorded', `${data.brand} ${data.model} - ₱${data.servicePrice}`);
    alert('Repair recorded successfully!');
    clearRepairForm();
}

// RECORD EXPENSE
window.recordExpense = async function() {
    const data = {
        type: 'expense',
        ownerUid: currentUser.uid,
        staffUid: currentUser.uid,
        staffName: currentUser.fullName,
        date: document.getElementById('expenseDate').value,
        expenseName: document.getElementById('expenseName').value,
        amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
        category: document.getElementById('expenseCat').value,
        timestamp: serverTimestamp()
    };

    if (!data.expenseName ||!data.amount) {
        alert('Please fill expense name and amount');
        return;
    }

    await addDoc(collection(db, 'transactions'), data);
    alert('Expense recorded successfully!');
    clearExpenseForm();
}

// LOAD TRANSACTIONS - WITH SEARCH
window.loadTransactions = function() {
    const typeFilter = document.getElementById('typeFilter').value;
    const timeFilter = document.getElementById('timeFilter').value;
    const dateFilter = document.getElementById('filterDate').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filtered = allTransactions.filter(t => {
        // Type filter
        if (typeFilter!== 'all' && t.type!== typeFilter) return false;

        // Date filter
        const transDate = t.date? new Date(t.date) : t.timestamp?.toDate();
        if (transDate) {
            const filterDate = new Date(dateFilter);
            if (timeFilter === 'daily') {
                if (transDate.toDateString()!== filterDate.toDateString()) return false;
            } else if (timeFilter === 'monthly') {
                if (transDate.getMonth()!== filterDate.getMonth() || transDate.getFullYear()!== filterDate.getFullYear()) return false;
            } else if (timeFilter === 'yearly') {
                if (transDate.getFullYear()!== filterDate.getFullYear()) return false;
            }
        }

        // Search filter
        if (searchTerm) {
            const searchFields = [
                t.itemName, t.brand, t.variant, t.customerName, t.model, t.issueJob, t.expenseName
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }

        return true;
    });

    // Sort by timestamp desc
    filtered.sort((a, b) => {
        const aTime = a.timestamp?.toDate() || new Date(a.date);
        const bTime = b.timestamp?.toDate() || new Date(b.date);
        return bTime - aTime;
    });

    let html = '';
    filtered.forEach((t, index) => {
        const badge = t.type === 'sale'? 'badge-sale' : t.type === 'repair'? 'badge-repair' : 'badge-expense';
        const dateStr = t.date? new Date(t.date).toLocaleString('en-PH') : t.timestamp?.toDate().toLocaleString('en-PH');
        let details = '';
        let value = '';

        if (t.type === 'sale') {
            details = `${t.itemName}<br>Capital: ₱${t.capitalCost}<br>Qty: ${t.qty}<br>Staff: ${t.staffName}`;
            value = `Price: ₱${t.sellPrice}<br><span class="profit-text">Profit: ₱${t.profit}</span>`;
        } else if (t.type === 'repair') {
            details = `${t.customerName}<br>${t.brand} ${t.model}<br>Job: ${t.issueJob}<br>Capital: ₱${t.partsCapital}<br>Staff: ${t.staffName}`;
            value = `Price: ₱${t.servicePrice}<br><span class="profit-text">Profit: ₱${t.profit}</span>`;
        } else {
            details = `${t.expenseName}<br>Category: ${t.category}`;
            value = `₱${t.amount}`;
        }

        html += `
            <tr>
                <td>${index + 1}</td>
                <td><span class="badge ${badge}">${t.type.toUpperCase()}</span></td>
                <td>${details}</td>
                <td>${dateStr}</td>
                <td>${value}</td>
                <td>
                    <button class="action-btn" onclick="editTransaction('${t.id}', '${t.type}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    document.getElementById('transTable').innerHTML = html || '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 40px;">No transactions found</td></tr>';
}

window.clearFilters = function() {
    document.getElementById('typeFilter').value = 'all';
    document.getElementById('timeFilter').value = 'daily';
    document.getElementById('searchInput').value = '';
    document.getElementById('filterDate').value = new Date().toISOString().split('T')[0];
    loadTransactions();
}

// DELETE TRANSACTION
window.deleteTransaction = async function(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    await deleteDoc(doc(db, 'transactions', id));
    alert('Transaction deleted');
}

// EDIT TRANSACTION
window.editTransaction = async function(id, type) {
    editDocId = id;
    editDocType = type;
    const trans = allTransactions.find(t => t.id === id);
    if (!trans) return;

    let formHtml = '';
    if (type === 'sale') {
        formHtml = `
            <div class="form-field"><label>Item Name</label><input type="text" id="editItemName" value="${trans.itemName}"></div>
            <div class="form-field"><label>Capital Cost</label><input type="number" id="editCapitalCost" value="${trans.capitalCost}"></div>
            <div class="form-field"><label>Selling Price</label><input type="number" id="editSellPrice" value="${trans.sellPrice}"></div>
            <div class="form-field"><label>Quantity</label><input type="number" id="editQty" value="${trans