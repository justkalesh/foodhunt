// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// You can also add other values here if you need them.
firebase.initializeApp({
    apiKey: "AIzaSyCNC_80YujtU_O3wtk4tKgw24jdfXZquRs", // Ideally loaded from env but SW has limited access. 
    authDomain: "food-hunt-101.firebaseapp.com",// For production, it's better to fetch config or hardcode the specific public safe keys if unavoidable. 
    projectId: "food-hunt-101",// But standard practice for sw in public folder often involves hardcoding or a build step.
    storageBucket: "food-hunt-101.firebasestorage.app",// Given this is a quick setup, we can try to rely on 'default' if it picks up from cache, but compat usually needs init.
    messagingSenderId: "23751876828",// We will trust the user to fill this or we can try to inject it. 
    appId: "1:23751876828:web:fdd3db56a631d389629419",// Let's rely on the fact that Vercel might not process this file for env vars. 
    // We will assume the user (or we) will fill this with the valid config from firebase.ts manually or via script.
    // For now, I will put a placeholder comment that we should ideally replace with real values.

    // Actually, wait, we can just use the values from the .env if we build this file? 
    // No, public files are static. 
    // We will follow the pattern of initializing with the object directly.
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Force SW to activate immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
});
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png'
    };

    // If the payload has a 'notification' property, the SDK handles it automatically.
    // Uncommenting the below line will verify reception but might cause duplicates.
    // self.registration.showNotification(notificationTitle, notificationOptions);
});
