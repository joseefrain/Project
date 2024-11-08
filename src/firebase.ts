import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);

serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

console.log(serviceAccount);


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: 'tienda-ebba2.appspot.com'
});

const bucket = admin.storage().bucket();

export { bucket };
