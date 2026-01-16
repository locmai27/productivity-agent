import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Use emulator config for local development
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "localhost",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

export const app = initializeApp(firebaseConfig);

// Get auth instance and connect to emulator in development
export const auth = getAuth(app);

// Connect to Auth emulator in development
// Must be called before any other Firebase Auth operations
if (import.meta.env.DEV) {
  try {
    // connectAuthEmulator can only be called once
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    console.log("Connected to Firebase Auth Emulator");
  } catch (error) {
    // Already connected, ignore error
    console.log("Auth emulator already connected");
  }
}