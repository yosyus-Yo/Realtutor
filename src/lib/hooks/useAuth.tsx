'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { signOut } from '../api/auth';

// 사용자 프로필 타입 정의
export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  learningPreferences?: {
    level: string;
    interests: string[];
    preferredInteractionMode: string;
  };
  createdAt: Date;
};

// 인증 컨텍스트 타입 정의
type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isInitialized: boolean;
  logout: () => Promise<{ success: boolean; error?: string }>;
};

// 기본값으로 컨텍스트 생성
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isInitialized: false,
  logout: async () => ({ success: true }),
});

// AuthProvider 컴포넌트
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // 로그아웃 함수
  const logout = async () => {
    try {
      const result = await signOut();
      setProfile(null);
      return result;
    } catch (error: any) {
      console.error('로그아웃 중 오류 발생:', error);
      return { success: false, error: error.message };
    }
  };

  // 사용자 프로필 생성
  const createUserProfile = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '사용자',
        photoURL: user.photoURL,
        createdAt: new Date(),
        learningPreferences: {
          level: 'beginner',
          interests: [],
          preferredInteractionMode: 'text'
        }
      };
      
      await setDoc(userRef, userData);
      return userData as UserProfile;
    } catch (error) {
      console.error('프로필 생성 중 오류 발생:', error);
      throw error;
    }
  };

  // 사용자 프로필 가져오기
  const fetchUserProfile = async (user: User) => {
    try {
      setLoading(true);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;
        setProfile(profileData);
        return profileData;
      } else {
        // 프로필이 없으면 새로 생성
        console.log('사용자 프로필이 존재하지 않습니다. 새 프로필을 생성합니다.');
        const newProfile = await createUserProfile(user);
        setProfile(newProfile);
        return newProfile;
      }
    } catch (error) {
      console.error('프로필 정보를 가져오는 중 오류 발생:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 인증 상태 변경 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setLoading(true);
      
      try {
        if (authUser) {
          setUser(authUser);
          await fetchUserProfile(authUser);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('인증 상태 변경 처리 중 오류 발생:', error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isInitialized, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 인증 상태를 사용하기 위한 커스텀 훅
export function useAuth() {
  return useContext(AuthContext);
} 