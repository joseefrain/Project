import * as admin from 'firebase-admin';
import * as serviceAccount from './serviceAccountKey.json'; 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: 'tienda-ebba2.appspot.com'
});

const bucket = admin.storage().bucket();

export { bucket };
