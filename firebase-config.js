// Firebase Configuration
// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCXdVSzcp_nsh0R44z49YDQBY-Y3yfeIrI",
    authDomain: "clickup-13942.firebaseapp.com",
    projectId: "clickup-13942",
    storageBucket: "clickup-13942.firebasestorage.app",
    messagingSenderId: "470528628434",
    appId: "1:470528628434:web:d31f383d7f7673942bbf0b",
    measurementId: "G-F0Q92W3DEK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

console.log('Firebase initialized successfully');

