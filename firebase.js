"use strict";

/* =========================================
   1. IMPORTAR O FIREBASE
   ========================================= */

// Inicializar a aplicação Firebase.
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

// Importar as funções de autenticação.
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    reload
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

/* =========================================
   IMPORTAR FUNÇÕES DO FIRESTORE
   ========================================= */

import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    serverTimestamp,
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    runTransaction
} from
    "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

/* =========================================
   2. CONFIGURAÇÃO DA NGOLA-EXPRES
   ========================================= */

const firebaseConfig = {
    apiKey: "AIzaSyAOi_Oh9mHKGLFT1FscT6Ct6YYD1J5QFd4",
    authDomain: "ngola-express.firebaseapp.com",
    projectId: "ngola-express",
    storageBucket: "ngola-express.firebasestorage.app",
    messagingSenderId: "954333827299",
    appId: "1:954333827299:web:0405e2e1bfde493fe8b5d6",
    measurementId: "G-W30SEER0Z1"
};


/* =========================================
   3. INICIALIZAR A APLICAÇÃO
   ========================================= */

const app = initializeApp(firebaseConfig);


/* =========================================
   4. ATIVAR A AUTENTICAÇÃO
   ========================================= */

const auth = getAuth(app);


/* =========================================
   5. LIGAR A BASE DE DADOS
   ========================================= */

const db = getFirestore(app);

/* =========================================
   6. EXPORTAR AS FUNÇÕES
   ========================================= */

export {
    auth,
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    reload,

       // Documentos
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    // Tempo do servidor
    serverTimestamp,

    // Funções dos chats e pedidos
    collection,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    runTransaction
};
