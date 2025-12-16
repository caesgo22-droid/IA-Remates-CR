import * as firebaseApp from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, getDoc, collection, getDocs, addDoc, query, orderBy, where } from "firebase/firestore";

// Safely access import.meta.env
const getEnv = () => {
  try {
    return (import.meta as any).env || {};
  } catch {
    return {};
  }
};
const env = getEnv();

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "mock_key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "mock_project",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: env.VITE_FIREBASE_APP_ID || "mock_app_id"
};

// Initialize Firebase only if we have some config, else mock basic behavior to prevent crash
let app;
let auth: any;
let db: any;
let googleProvider: any;

try {
  // Use namespace import to resolve potential module resolution issues
  app = firebaseApp.initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  console.warn("Firebase initialization failed (likely due to missing env vars). App will run in local-only mode.");
  auth = { currentUser: null, onAuthStateChanged: () => () => {} };
  db = {};
}

export { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  collection, 
  getDocs,
  addDoc,
  query,
  orderBy,
  where
};