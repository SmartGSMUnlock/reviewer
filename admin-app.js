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

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// SIDEBAR - FIXED: WALA NA TINATAGO YUNG CARDS
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('expanded');
}

// FIXED: May element parameter na
window.showSection = function(section, element) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    // Show selected section
    document.getElementById(section + '-section').classList.add('active');
    // Update sidebar active state
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    if (element) element.classList.add('active');
    // Close sidebar on mobile
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('expanded');
    // Load chart if charts section
    if (section === 'charts') loadChart();
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
    local
