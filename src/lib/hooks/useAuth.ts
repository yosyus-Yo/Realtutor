import { useState, useEffect, useContext, createContext } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  getIdToken,
  getAuth
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { createUserProfile } from '../api/auth';

// 사용자 프로필 인터페이스
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: Date;
  learningPreferences?: {
    level: 'beginner' | 'intermediate' | 'advanced';
    interactionMode: 'text' | 'voice' | 'visual';
    interests: string[];
  }
  lastLoginAt?: Date;
}

// Context 값 인터페이스
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isInitialized: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string|null>;
}

// 기본값 설정
const defaultAuthContext: AuthContextType = {
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,
  error: null,
  logout: async () => {},
  refreshToken: async () => null
};

// Context 생성
const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Provider 컴포넌트
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사용자 프로필 데이터 구독
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileRef = doc(db, 'userProfiles', user.uid);
    
    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Omit<UserProfile, 'uid'>;
          setProfile({
            uid: user.uid,
            ...data,
            createdAt: data.createdAt ? (data.createdAt as any).toDate() : new Date(),
            lastLoginAt: data.lastLoginAt ? (data.lastLoginAt as any).toDate() : new Date()
          });
        } else {
          // 프로필이 없으면 자동으로 생성
          console.log('프로필을 찾을 수 없어 새로 생성합니다:', user.uid);
          createUserProfile(user)
            .then(() => console.log('프로필 생성 완료'))
            .catch((err) => {
              console.error('프로필 생성 오류:', err);
              setError('사용자 프로필을 생성하는 도중 오류가 발생했습니다.');
            });
        }
      },
      (err) => {
        console.error('프로필 구독 오류:', err);
        setError('사용자 프로필 정보를 가져오는 도중 오류가 발생했습니다.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 인증 상태 관찰자
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setUser(user);
        setLoading(false);
        setIsInitialized(true);
        
        // 인증 토큰 주기적 갱신 (권한 문제 해결)
        if (user) {
          try {
            // 로그인 시 토큰 즉시 갱신
            await getIdToken(user, true);
            console.log('인증 토큰이 갱신되었습니다.');
            
            // 30분마다 토큰 갱신 (토큰 만료 예방)
            const tokenRefreshInterval = setInterval(async () => {
              try {
                await getIdToken(user, true);
                console.log('인증 토큰 정기 갱신 완료');
              } catch (err) {
                console.error('정기 토큰 갱신 오류:', err);
              }
            }, 30 * 60 * 1000);
            
            // 컴포넌트 언마운트 시 인터벌 정리
            return () => clearInterval(tokenRefreshInterval);
          } catch (err) {
            console.error('토큰 갱신 오류:', err);
          }
        }
      },
      (err) => {
        console.error('인증 상태 관찰자 오류:', err);
        setError('인증 상태를 확인하는 도중 오류가 발생했습니다.');
        setLoading(false);
        setIsInitialized(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // 토큰 갱신 함수
  const refreshToken = async (): Promise<string|null> => {
    try {
      if (!user) return null;
      console.log('토큰 갱신 시도 중...');
      const token = await getIdToken(user, true);
      console.log('인증 토큰이 갱신되었습니다.');
      return token;
    } catch (err) {
      console.error('토큰 갱신 오류:', err);
      return null;
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      console.error('로그아웃 오류:', err);
      setError('로그아웃 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const value = {
    user,
    profile,
    loading,
    isInitialized,
    error,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom Hook
export const useAuth = () => useContext(AuthContext); 