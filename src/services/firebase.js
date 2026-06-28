import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  updateDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseIsConfigured = Object.values(firebaseConfig).every(Boolean);
export const firebaseAuthEmail = import.meta.env.VITE_FIREBASE_AUTH_EMAIL;

const app = firebaseIsConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

export async function signInAlbum(password) {
  if (!firebaseIsConfigured || !firebaseAuthEmail) {
    const localPassword = import.meta.env.VITE_ALBUM_PASSWORD;

    if (!localPassword) {
      throw new Error("Set VITE_ALBUM_PASSWORD in your .env.local file first.");
    }

    if (password !== localPassword) {
      throw new Error("That password did not match.");
    }

    return;
  }

  await setPersistence(auth, browserSessionPersistence);
  await signInWithEmailAndPassword(auth, firebaseAuthEmail, password);
}

export async function signOutAlbum() {
  if (auth?.currentUser) {
    await signOut(auth);
  }
}

export async function getAlbumItems() {
  if (!firebaseIsConfigured) return [];

  const albumQuery = query(collection(db, "albumItems"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(albumQuery);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function addAlbumItem(item) {
  ensureConfigured();

  const docRef = await addDoc(collection(db, "albumItems"), {
    ...item,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...item,
    createdAt: new Date(),
  };
}

export async function deleteAlbumItem(id) {
  ensureConfigured();
  await waitForSignedInUser();

  try {
    await deleteDoc(doc(db, "albumItems", id));
  } catch (error) {
    throw new Error(getFirestoreDeleteMessage(error));
  }
}

export async function updateAlbumItem(id, fields) {
  ensureConfigured();
  await waitForSignedInUser();
  const ref = doc(db, "albumItems", id);
  await updateDoc(ref, fields);
}

function ensureConfigured() {
  if (!firebaseIsConfigured) {
    throw new Error("Firebase is not configured yet.");
  }
}

async function waitForSignedInUser() {
  if (!auth || !firebaseAuthEmail) return;
  if (auth.currentUser) return;

  const user = await new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(currentUser);
    });
  });

  if (!user) {
    throw new Error("Please log out and log back in before deleting.");
  }
}

function getFirestoreDeleteMessage(error) {
  if (error?.code === "permission-denied") {
    return "Firestore rules are blocking delete. Add delete permission for your albumItems collection.";
  }

  return error?.message || "Could not delete this memory.";
}
