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
    return `${year}-${month}-${day}T${hours}:${