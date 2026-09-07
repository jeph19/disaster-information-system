import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase web configuration is intentionally public. The optional Vite values
 * are the supplied web config; no service-account or other server credential is
 * ever bundled into the browser.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyB2xBsXpnxvySlftSz08jEnUzX7vTsMwFw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'sentinel-9fdc4.firebaseapp.com',
  projectId: 'sentinel-9fdc4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'sentinel-9fdc4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '355435996713',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:355435996713:web:0d80a807744aed30325e38',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-7ZNS41H1PP',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const firebaseAuth = getAuth(app);
