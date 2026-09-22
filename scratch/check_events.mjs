import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyBl-vfnhufHAyvR4nOJNd-DCkm5lCZJ-Sk",
  authDomain: "saintjspmrscoe.firebaseapp.com",
  projectId: "saintjspmrscoe",
  storageBucket: "saintjspmrscoe.firebasestorage.app",
  messagingSenderId: "53248989106",
  appId: "1:53248989106:web:9729ce758edbfcee83f6ab",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const snap = await getDocs(collection(db, 'events'));
  const events = [];
  snap.forEach(doc => {
    const data = doc.data();
    events.push({
      id: doc.id,
      title: data.title,
      status: data.status,
      imageURL: data.imageURL,
      registrationBannerUrl: data.registrationBannerUrl,
    });
  });
  fs.writeFileSync('scratch/all_events.json', JSON.stringify(events, null, 2));
  console.log(`Saved ${events.length} events to scratch/all_events.json`);
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
