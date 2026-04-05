import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyBxo495R67Wvbsg-Bk44eZrsEAXnc5vmbk',
  authDomain: 'pwd-employment-assistance.firebaseapp.com',
  projectId: 'pwd-employment-assistance',
  storageBucket: 'pwd-employment-assistance.firebasestorage.app',
  messagingSenderId: '826168994985',
  appId: '1:826168994985:web:71d3ca588626fe5f830db8',
  measurementId: 'G-14K7T9JV0W',
}

const CLOUD_FUNCTIONS_REGION = 'us-central1'
const FIREBASE_PROJECT_ID = firebaseConfig.projectId

const hasExistingApp = getApps().length > 0

const app = hasExistingApp ? getApp() : initializeApp(firebaseConfig)
const db = hasExistingApp
  ? getFirestore(app)
  : initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })
const auth = getAuth(app)
const cloudFunctions = getFunctions(app, CLOUD_FUNCTIONS_REGION)
const storage = getStorage(app)

export { app, auth, cloudFunctions, CLOUD_FUNCTIONS_REGION, db, FIREBASE_PROJECT_ID, storage }
