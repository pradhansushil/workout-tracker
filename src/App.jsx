import { useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

function App() {
  useEffect(() => {
    const testFirestore = async () => {
      try {
        // Write a test document
        const docRef = await addDoc(collection(db, "testCollection"), {
          message: "Hello Firebase!",
          timestamp: new Date(),
        });
        console.log("Document written with ID:", docRef.id);

        // Read it back
        const querySnapshot = await getDocs(collection(db, "testCollection"));
        querySnapshot.forEach((doc) => {
          console.log(doc.id, "=>", doc.data());
        });
      } catch (error) {
        console.error("Firebase error:", error);
      }
    };

    testFirestore();
  }, []);

  return (
    <div>
      <h1>Firebase Connection Test</h1>
      <p>Check the browser console (F12) for results.</p>
    </div>
  );
}

export default App;
