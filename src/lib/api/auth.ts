import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  User,
  sendPasswordResetEmail,
  AuthErrorCodes
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Firebase 에러 메시지 한국어로 변환
const getKoreanErrorMessage = (errorCode: string): string => {
  console.log('Firebase 오류 코드:', errorCode); // 디버깅용 오류 코드 출력
  
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일 주소입니다. 로그인을 시도하거나 다른 이메일을 사용해주세요.';
    case 'auth/invalid-email':
      return '유효하지 않은 이메일 형식입니다. 올바른 이메일 주소를 입력해주세요.';
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. 최소 6자 이상의 강력한 비밀번호를 설정해주세요.';
    case 'auth/user-not-found':
      return '해당 이메일로 등록된 사용자가 없습니다. 이메일을 확인하거나 회원가입을 해주세요.';
    case 'auth/wrong-password':
      return '비밀번호가 올바르지 않습니다. 다시 확인 후 시도해주세요.';
    case 'auth/too-many-requests':
      return '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/popup-closed-by-user':
      return '로그인 창이 닫혔습니다. 소셜 로그인을 완료하려면 팝업 창을 닫지 마세요.';
    case 'auth/unauthorized-domain':
      return '이 도메인에서는 인증이 허용되지 않습니다. 관리자에게 문의해주세요.';
    case 'auth/operation-not-allowed':
      return '이 인증 방법은 현재 사용할 수 없습니다. 관리자에게 문의해주세요.';
    case 'auth/account-exists-with-different-credential':
      return '이 이메일로 이미 다른 인증 방법으로 가입된 계정이 있습니다. 다른 로그인 방식을 시도해보세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인 후 다시 시도해주세요.';
    case 'auth/invalid-credential':
      return '인증 정보가 잘못되었습니다. 다시 로그인을 시도해주세요.';
    case 'auth/internal-error':
      return '내부 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    default:
      return `인증 과정에서 오류가 발생했습니다. 오류 코드: ${errorCode}`;
  }
};

// 이메일/비밀번호로 회원가입
export const signUp = async (email: string, password: string, name: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 사용자 프로필 업데이트
    await updateProfile(user, {
      displayName: name
    });
    
    // Firestore에 사용자 정보 저장
    await createUserProfile(user, { name });
    
    return { success: true, user };
  } catch (error: any) {
    console.error('회원가입 오류:', error);
    // 오류 코드와 함께 자세한 메시지 반환
    return { 
      success: false, 
      error: getKoreanErrorMessage(error.code) || error.message,
      errorCode: error.code  // 오류 코드도 함께 반환하여 프론트엔드에서 활용할 수 있게 함
    };
  }
};

// 이메일/비밀번호로 로그인
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error('로그인 오류:', error);
    return { 
      success: false, 
      error: getKoreanErrorMessage(error.code) || error.message 
    };
  }
};

// 구글 로그인
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    
    // 사용자 프로필이 있는지 확인하고 없으면 생성
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      await createUserProfile(user, {
        name: user.displayName || '사용자'
      });
    }
    
    return { success: true, user };
  } catch (error: any) {
    console.error('구글 로그인 오류:', error);
    return { 
      success: false, 
      error: getKoreanErrorMessage(error.code) || error.message 
    };
  }
};

// 로그아웃
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error: any) {
    console.error('로그아웃 오류:', error);
    return { 
      success: false, 
      error: getKoreanErrorMessage(error.code) || error.message 
    };
  }
};

// 비밀번호 재설정 이메일 전송
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: any) {
    console.error('비밀번호 재설정 오류:', error);
    return { 
      success: false, 
      error: getKoreanErrorMessage(error.code) || error.message 
    };
  }
};

// Firestore에 사용자 프로필 생성
export const createUserProfile = async (user: User, additionalData: any = {}) => {
  const userRef = doc(db, 'users', user.uid);
  
  try {
    // 이미 존재하는 프로필인지 확인
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      console.log('사용자 프로필이 이미 존재합니다.');
      return { success: true, profile: userDoc.data() };
    }
    
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: additionalData.name || user.displayName,
      photoURL: user.photoURL,
      createdAt: new Date(),
      // 기본 학습 설정
      learningPreferences: {
        level: 'beginner',
        interests: [],
        preferredInteractionMode: 'text'
      },
      // 기타 필요한 필드 추가
      ...additionalData
    };
    
    await setDoc(userRef, userData);
    
    return { success: true, profile: userData };
  } catch (error: any) {
    console.error('사용자 프로필 생성 오류:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}; 