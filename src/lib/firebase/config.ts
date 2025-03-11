// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Firebase 설정
// 실제 프로덕션 환경에서는 환경 변수를 사용해야 합니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDe_HcMuVxJiJv04zzAUy_bWeRDEaFnkwo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "realtutor-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "realtutor-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "realtutor-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "184068851840",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:184068851840:web:a4e8f274275cba601cfe65",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-Q4NBB2S9C1"
};

// Firebase 초기화 상태를 추적
let isInitialized = false;

// Firebase 앱 초기화 (중복 초기화 방지)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase 서비스 초기화
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 인증 지속성 설정
if (typeof window !== 'undefined' && !isInitialized) {
  // 브라우저 환경에서만 실행
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase 인증 지속성이 로컬로 설정되었습니다.');
    })
    .catch((error) => {
      console.error('인증 지속성 설정 오류:', error);
    });

  // 오프라인 지원을 위한 Firestore 인덱싱 활성화
  if (process.env.NODE_ENV === 'production') {
    enableIndexedDbPersistence(db)
      .then(() => {
        console.log('Firestore 오프라인 지속성이 활성화되었습니다.');
      })
      .catch((error) => {
        console.error('Firestore 오프라인 지속성 활성화 오류:', error);
      });
  }

  isInitialized = true;
}

// 개발 환경에서 에뮬레이터 연결 (선택 사항)
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  try {
    // Auth 에뮬레이터
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    
    // Firestore 에뮬레이터
    connectFirestoreEmulator(db, 'localhost', 8080);
    
    // Storage 에뮬레이터
    connectStorageEmulator(storage, 'localhost', 9199);
    
    console.log('Firebase 에뮬레이터에 연결되었습니다.');
  } catch (error) {
    console.error('Firebase 에뮬레이터 연결 오류:', error);
  }
}

export { auth, db, storage };
export default app;   