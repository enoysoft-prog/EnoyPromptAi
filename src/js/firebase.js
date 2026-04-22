// src/js/firebase.js — User site Firebase init (Auth + Firestore)
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBJr1bOkBo2Lvc5TWfVmYvmZLyZ8MxW69I",
  authDomain:        "prompt-vault-f41e0.firebaseapp.com",
  projectId:         "prompt-vault-f41e0",
  storageBucket:     "prompt-vault-f41e0.firebasestorage.app",
  messagingSenderId: "37807382327",
  appId:             "1:37807382327:web:51554a199a950f7265c4b2"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };
