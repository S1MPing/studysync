import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBbaFkPa_BL2-rB_dQty4qiwbKGXL3ISes",
  authDomain: "studysync-360ca.firebaseapp.com",
  projectId: "studysync-360ca",
  storageBucket: "studysync-360ca.firebasestorage.app",
  messagingSenderId: "504540018369",
  appId: "1:504540018369:web:0fb356ee37446f4fc98640"
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
