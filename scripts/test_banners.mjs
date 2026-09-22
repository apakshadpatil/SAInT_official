import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function main() {
  const snap = await getDocs(collection(db, 'events'));
  console.log(`Found ${snap.size} events:`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`- ID: ${d.id} | Title: "${data.title}" | Status: ${data.status} | imageURL: ${Boolean(data.imageURL)} | regBanner: ${Boolean(data.registrationBannerUrl)}`);
  });
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
