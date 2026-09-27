// Configuración de tu proyecto Firebase.
// Este "apiKey" NO es secreto: Google lo diseñó para vivir en código
// público del lado del cliente. Lo que de verdad protege tus datos
// son las reglas de Firestore (ver firestore.rules).
const firebaseConfig = {
  apiKey: "AIzaSyC8h98EsYENMjlcYMVzScA1Ez6KM1q9LfM",
  authDomain: "calendario-app-3a7ee.firebaseapp.com",
  projectId: "calendario-app-3a7ee",
  storageBucket: "calendario-app-3a7ee.firebasestorage.app",
  messagingSenderId: "558035988002",
  appId: "1:558035988002:web:c597556a5c855fbab2247b",
  measurementId: "G-2B2PY1X03Y"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();