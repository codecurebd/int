// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  updatePassword,
  deleteUser,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider,
  updateEmail,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB15-BRCf0ejIYCDb4Wx-N70gXGx9-R29I",
  authDomain: "simple-store-4175f.firebaseapp.com",
  projectId: "simple-store-4175f",
  storageBucket: "simple-store-4175f.firebasestorage.app",
  messagingSenderId: "708569270600",
  appId: "1:708569270600:web:c5e647d52de75fdf194b7d",
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
  }),
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('profile');
googleProvider.addScope('email');
const githubProvider = new GithubAuthProvider(); // kept for compatibility; UI no longer uses GitHub

// ========== নতুন ফাংশন (অ্যাডমিন প্যানেলের জন্য) ==========

// ✅ অ্যাডমিন প্যানেল থেকে ইউজার তৈরি (Authentication + Firestore)
export async function adminCreateUser(email, password, displayName, role, adminEmail, adminPassword) {
  try {
    // অ্যাডমিনকে সাইন ইন করি (বর্তমান ইউজার যাই হোক)
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    // ইউজার তৈরি
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;
    await setDoc(doc(db, 'users', user.uid), {
      email,
      displayName: displayName || email.split('@')[0],
      role: role || 'user',
      createdAt: new Date().toISOString(),
      isActive: true,
      emailVerified: false,
    });
    await sendEmailVerification(user);
    // আবার অ্যাডমিনকে সাইন ইন করি
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    return { success: true, uid: user.uid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ✅ অ্যাডমিন: ইউজার ডিলিট + অর্ডার আর্কাইভ (Auth ডিলিট = Cloud Function লাগে)
export async function adminDeleteUser(uid, adminEmail, adminPassword) {
  try {
    // Verify admin password (re-auth)
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, error: 'User not found in database' };
    }
    const userData = userSnap.data();
    if (userData.role === 'admin') {
      return { success: false, error: 'Cannot delete an admin account from panel' };
    }

    // Archive all orders of this user
    const ordersQ = query(collection(db, 'orders'), where('userId', '==', uid));
    const ordersSnap = await getDocs(ordersQ);
    let archivedCount = 0;
    const archivePromises = [];
    ordersSnap.forEach((orderDoc) => {
      const orderData = orderDoc.data();
      archivePromises.push(
        setDoc(doc(db, 'archivedOrders', orderDoc.id), {
          ...orderData,
          originalOrderId: orderDoc.id,
          archivedAt: new Date().toISOString(),
          archivedReason: 'user_deleted',
          deletedUserId: uid,
          deletedUserEmail: userData.email || '',
          deletedUserName: userData.displayName || '',
        }).then(() => deleteDoc(doc(db, 'orders', orderDoc.id)))
      );
      archivedCount++;
    });
    await Promise.all(archivePromises);

    // Archive user profile
    await setDoc(doc(db, 'deletedUsers', uid), {
      ...userData,
      originalUid: uid,
      deletedAt: new Date().toISOString(),
      deletedBy: auth.currentUser?.uid || '',
      deletedByEmail: adminEmail,
      archivedOrdersCount: archivedCount,
    });

    // Remove from active users collection
    await deleteDoc(userRef);

    // Try Cloud Function to delete Firebase Auth user (needed for same-email re-registration)
    let authDeleted = false;
    let authDeleteError = null;
    try {
      const { getFunctions, httpsCallable } = await import(
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js'
      );
      const functions = getFunctions(app, 'us-central1');
      const deleteAuthUser = httpsCallable(functions, 'deleteAuthUser');
      await deleteAuthUser({ uid });
      authDeleted = true;
    } catch (fnErr) {
      authDeleteError = fnErr.message || String(fnErr);
      console.warn('Auth delete via Cloud Function failed:', fnErr);
    }

    return {
      success: true,
      archivedOrders: archivedCount,
      authDeleted,
      authDeleteError,
      email: userData.email,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ✅ Google Sign-In helper (creates Firestore user doc if new)
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    await setDoc(userRef, {
      email: user.email || '',
      displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
      photoURL: user.photoURL || '',
      role: 'user',
      createdAt: new Date().toISOString(),
      isActive: true,
      emailVerified: !!user.emailVerified,
    });
  }
  return user;
}

// ========== সব export ==========
export {
  auth, db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  updatePassword,
  deleteUser,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  GithubAuthProvider,
  googleProvider,
  githubProvider,
  updateEmail,
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment,
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
};