const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
} catch (error) {
  console.error("Error initializing Firebase Admin SDK. Make sure 'serviceAccountKey.json' is present in the same directory.");
  console.error(error.message);
  process.exit(1);
}


const rtdb = admin.database();
const firestore = admin.firestore();

async function migrateData() {
  console.log('Fetching data from Realtime Database...');
  const logsRef = rtdb.ref('logs');
  const snapshot = await logsRef.once('value');
  const logsData = snapshot.val();

  if (!logsData) {
    console.log('No data found in Realtime Database. Nothing to migrate.');
    return;
  }

  console.log(`Found ${Object.keys(logsData).length} records to migrate.`);

  const logsCollection = firestore.collection('logs');
  let migratedCount = 0;
  const promises = [];

  for (const id in logsData) {
    const logEntry = logsData[id];
    
    // Create a new object for Firestore to ensure clean data
    const firestoreEntry = {
      timestamp: logEntry.timestamp,
      lat: logEntry.lat,
      lng: logEntry.lng,
      memo: logEntry.memo || null,
      amount: typeof logEntry.amount === 'number' ? logEntry.amount : null,
      amount_category: logEntry.amount_category || 'その他',
      // New fields will be absent, which is fine
      stars: logEntry.stars || null,
      locationName: logEntry.locationName || null
    };

    promises.push(logsCollection.add(firestoreEntry).then(() => {
      migratedCount++;
    }));
  }

  await Promise.all(promises);

  console.log(`Successfully migrated ${migratedCount} records to Firestore.`);
  console.log('Migration complete!');
}

migrateData().catch(error => {
  console.error('An error occurred during migration:', error);
});
