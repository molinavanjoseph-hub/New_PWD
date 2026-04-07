import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
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

const shouldUseFunctionsEmulator = import.meta.env.DEV
  && String(import.meta.env.VITE_USE_FUNCTIONS_EMULATOR || '').toLowerCase() === 'true'

if (shouldUseFunctionsEmulator) {
  const emulatorHost = String(import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1').trim() || '127.0.0.1'
  const emulatorPort = Number.parseInt(String(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || '5001'), 10)

  if (Number.isFinite(emulatorPort) && emulatorPort > 0) {
    connectFunctionsEmulator(cloudFunctions, emulatorHost, emulatorPort)
  }
}

export { app, auth, cloudFunctions, CLOUD_FUNCTIONS_REGION, db, FIREBASE_PROJECT_ID, storage }
