import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './config';
import { UserProfile } from '@/types';

/**
 * Sign up a new user with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
): Promise<UserProfile> {
  try {
    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create Firestore document for user
    const userRef = doc(firestore, `user-data/${user.uid}`);
    await setDoc(userRef, {
      email: email,
      username: username,
      devices: {},
    });

    return {
      userId: user.uid,
      email: email,
      username: username,
    };
  } catch (error) {
    // Provide more specific error messages
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please sign in instead.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email format. Please check your email.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use at least 6 characters.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/password accounts are not enabled. Contact support.');
      }
    }
    const message = error instanceof Error ? error.message : 'Failed to sign up';
    throw new Error(message);
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserProfile> {
  try {
    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch user document from Firestore
    const userRef = doc(firestore, `user-data/${user.uid}`);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new Error('User profile not found');
    }

    const userData = userSnapshot.data();

    return {
      userId: user.uid,
      email: userData.email,
      username: userData.username,
    };
  } catch (error) {
    // Provide more specific error messages
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password. Please check your credentials.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email. Please sign up first.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email format. Please check your email.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Contact support.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed login attempts. Please try again later.');
      }
    }
    const message = error instanceof Error ? error.message : 'Failed to sign in';
    throw new Error(message);
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign out';
    throw new Error(message);
  }
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
