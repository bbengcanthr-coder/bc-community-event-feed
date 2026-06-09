// ดึง Firebase SDK (เวอร์ชัน Modular) ผ่าน CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// !!! นำตั้งค่าโปรเจกต์คุณจาก Firebase Console มาวางที่นี่ !!!
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQ_os9XetJjej6cUHUp1WifIHpZTH0bHQ",
  authDomain: "bc-community-event-feed.firebaseapp.com",
  projectId: "bc-community-event-feed",
  storageBucket: "bc-community-event-feed.firebasestorage.app",
  messagingSenderId: "979902152738",
  appId: "1:979902152738:web:f89343c6ca406fafa04a7b",
  measurementId: "G-BK23JHMDQ7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginGoogleBtn = document.getElementById('login-google-btn');
const loginFacebookBtn = document.getElementById('login-facebook-btn');
const authSection = document.getElementById('auth-section');
const postBtn = document.getElementById('post-btn');
const eventInput = document.getElementById('event-input');
const feedContainer = document.getElementById('feed-container');
const currentUserAvatar = document.getElementById('current-user-avatar');
const defaultAvatar = document.getElementById('default-avatar');

let currentUser = null;

// --- ระบบ Authentication ---

// เช็คสถานะการเข้าสู่ระบบ
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // เปลี่ยนปุ่ม Login เป็นปุ่ม Logout
        authSection.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <img src="${user.photoURL}" style="width:40px; border-radius:50%;">
                <div style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.displayName}</div>
            </div>
            <button id="logout-btn" class="btn-primary" style="background-color: var(--text-muted);">ออกจากระบบ</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        
        // อัปเดตรูปโปรไฟล์ในช่องโพสต์
        currentUserAvatar.src = user.photoURL;
        currentUserAvatar.style.display = 'block';
        defaultAvatar.style.display = 'none';
        postBtn.disabled = false;
    } else {
        currentUser = null;
        // หากยังไม่ล็อกอิน ให้แสดงปุ่มล็อกอินตามเดิม (รีโหลดหน้าเพื่อความชัวร์)
        if(currentUserAvatar.style.display === 'block') {
             window.location.reload();
        }
        postBtn.disabled = true;
    }
});

// ฟังก์ชัน Login Google
loginGoogleBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error(error));
});

// ฟังก์ชัน Login Facebook
loginFacebookBtn.addEventListener('click', () => {
    const provider = new FacebookAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error(error));
});


// --- ระบบจัดการโพสต์อีเว้นท์ (Firestore) ---

// ปลดล็อกปุ่มโพสต์เมื่อมีการพิมพ์
eventInput.addEventListener('input', () => {
    if (currentUser && eventInput.value.trim().length > 0) {
        postBtn.disabled = false;
    } else {
        postBtn.disabled = true;
    }
});

// ส่งข้อมูลโพสต์ขึ้น Firestore
postBtn.addEventListener('click', async () => {
    const text = eventInput.value.trim();
    if (!text || !currentUser) return;

    postBtn.disabled = true;
    postBtn.innerText = 'กำลังโพสต์...';

    try {
        await addDoc(collection(db, "events"), {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            text: text,
            timestamp: serverTimestamp()
        });
        eventInput.value = ''; // เคลียร์ช่องแชท
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("เกิดข้อผิดพลาดในการโพสต์");
    } finally {
        postBtn.innerText = 'โพสต์นัดหมาย';
        postBtn.disabled = false;
    }
});

// --- ระบบดึงฟีด Real-time (onSnapshot) ---

// ดึงข้อมูลอีเว้นท์มาแสดง (เรียงจากใหม่ไปเก่า)
const q = query(collection(db, "events"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
    feedContainer.innerHTML = ''; // ล้างฟีดเก่า
    
    if (snapshot.empty) {
        feedContainer.innerHTML = '<div class="loading-text">ยังไม่มีอีเว้นท์ในคอมมูนิตี้ตอนนี้ เป็นคนแรกที่เริ่มนัดเลย!</div>';
        return;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        const timeString = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'เมื่อสักครู่';
        
        // สร้าง HTML สำหรับแต่ละโพสต์
        const tweetElement = document.createElement('div');
        tweetElement.className = 'tweet';
        tweetElement.innerHTML = `
            <div class="tweet-avatar">
                <img src="${data.photoURL || 'https://via.placeholder.com/48'}" alt="Avatar">
            </div>
            <div class="tweet-content">
                <div class="tweet-header">
                    <span class="tweet-name">${data.displayName}</span>
                    <span class="tweet-time">• ${timeString}</span>
                </div>
                <div class="tweet-text">
                    ${data.text.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
        feedContainer.appendChild(tweetElement);
    });
});
