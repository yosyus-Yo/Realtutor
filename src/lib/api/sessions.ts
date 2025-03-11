import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  FieldValue,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from 'firebase/auth';

// 세션 타입
export interface SessionData {
  id?: string;
  userId: string;
  subject: string;
  level: string;
  goal: string;
  interactionMode: 'text' | 'voice' | 'visual';
  createdAt: Timestamp | FieldValue | null;
  lastUpdatedAt: Timestamp | FieldValue | null;
  isActive: boolean;
  summary?: string;
}

// 메시지 타입
export interface Message {
  id?: string;
  sessionId: string;
  content: string;
  role: 'user' | 'tutor';
  timestamp: Timestamp | FieldValue | null;
  attachments?: {
    type: 'image' | 'audio' | 'file';
    url: string;
    mimeType: string;
  }[];
}

/**
 * 새 학습 세션 생성
 */
export const createSession = async (
  user: User,
  subject: string,
  level: string,
  goal: string,
  interactionMode: 'text' | 'voice' | 'visual' = 'text'
): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
  try {
    const sessionsRef = collection(db, 'sessions');
    
    const sessionData: Omit<SessionData, 'id'> = {
      userId: user.uid,
      subject,
      level,
      goal,
      interactionMode,
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
      isActive: true
    };
    
    const docRef = await addDoc(sessionsRef, sessionData);
    
    return {
      success: true,
      sessionId: docRef.id
    };
  } catch (error: any) {
    console.error('세션 생성 오류:', error);
    return {
      success: false,
      error: error.message || '세션을 생성하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 세션 정보 가져오기
 */
export const getSession = async (sessionId: string): Promise<{ success: boolean; session?: SessionData; error?: string }> => {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      return {
        success: false,
        error: '세션을 찾을 수 없습니다.'
      };
    }
    
    const sessionData = sessionSnap.data() as Omit<SessionData, 'id'>;
    
    return {
      success: true,
      session: {
        ...sessionData,
        id: sessionId
      }
    };
  } catch (error: any) {
    console.error('세션 조회 오류:', error);
    return {
      success: false,
      error: error.message || '세션 정보를 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 세션 목록 가져오기
 */
export const getUserSessions = async (userId: string, activeOnly = false): Promise<{ success: boolean; sessions?: SessionData[]; error?: string }> => {
  try {
    const sessionsRef = collection(db, 'sessions');
    
    // Firestore 인덱스 오류를 방지하기 위한 쿼리 전략
    let q;
    try {
      // 복합 쿼리 시도 (인덱스가 있는 경우)
      if (activeOnly) {
        q = query(
          sessionsRef,
          where('userId', '==', userId),
          where('isActive', '==', true),
          orderBy('lastUpdatedAt', 'desc')
        );
      } else {
        q = query(
          sessionsRef,
          where('userId', '==', userId),
          orderBy('lastUpdatedAt', 'desc')
        );
      }
    } catch (indexError) {
      console.warn('복합 쿼리에 필요한 인덱스가 없습니다. 대체 쿼리 사용:', indexError);
      // 인덱스가 없는 경우 간단한 쿼리로 대체
      if (activeOnly) {
        q = query(
          sessionsRef,
          where('userId', '==', userId),
          where('isActive', '==', true)
        );
      } else {
        q = query(
          sessionsRef,
          where('userId', '==', userId)
        );
      }
    }
    
    try {
      const querySnapshot = await getDocs(q);
      
      let sessions: SessionData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<SessionData, 'id'>;
        sessions.push({
          ...data,
          id: doc.id
        });
      });
      
      // 인덱스가 없는 경우 클라이언트 측에서 정렬
      if (!q.toString().includes('orderBy')) {
        sessions = sessions.sort((a, b) => {
          // Firestore Timestamp 타입 안전하게 처리
          const getTime = (timestamp: any) => {
            if (timestamp && typeof timestamp.toDate === 'function') {
              return timestamp.toDate().getTime();
            }
            return 0;
          };
          
          return getTime(b.lastUpdatedAt) - getTime(a.lastUpdatedAt);
        });
      }
      
      return {
        success: true,
        sessions
      };
    } catch (queryError: any) {
      // 인덱스 오류인 경우
      if (queryError.message && queryError.message.includes('index')) {
        console.error('Firestore 인덱스 오류:', queryError);
        // 인덱스 생성을 위한 URL 추출 시도
        const indexUrl = queryError.message.match(/https:\/\/console\.firebase\.google\.com\/[^\s]*/);
        return {
          success: false,
          error: `Firestore 인덱스가 필요합니다. ${indexUrl ? '다음 링크에서 인덱스를 생성해주세요: ' + indexUrl[0] : ''}`
        };
      }
      
      throw queryError;
    }
  } catch (error: any) {
    console.error('세션 목록 조회 오류:', error);
    return {
      success: false,
      error: error.message || '세션 목록을 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 세션 업데이트
 */
export const updateSession = async (
  sessionId: string,
  updates: Partial<Omit<SessionData, 'id' | 'userId' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    
    // lastUpdatedAt 자동 업데이트
    const updatedData = {
      ...updates,
      lastUpdatedAt: serverTimestamp()
    };
    
    await updateDoc(sessionRef, updatedData);
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('세션 업데이트 오류:', error);
    return {
      success: false,
      error: error.message || '세션을 업데이트하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 세션 완료 처리
 */
export const completeSession = async (
  sessionId: string,
  summary?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    
    await updateDoc(sessionRef, {
      isActive: false,
      summary,
      lastUpdatedAt: serverTimestamp()
    });
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('세션 완료 처리 오류:', error);
    return {
      success: false,
      error: error.message || '세션을 완료 처리하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 메시지 추가
 */
export const addMessage = async (
  sessionId: string,
  content: string,
  role: 'user' | 'tutor',
  attachments?: {
    type: 'image' | 'audio' | 'file';
    url: string;
    mimeType: string;
  }[]
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // 세션 존재 여부 확인
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      return {
        success: false,
        error: '세션을 찾을 수 없습니다.'
      };
    }
    
    // 세션의 lastUpdatedAt 업데이트
    await updateDoc(sessionRef, {
      lastUpdatedAt: serverTimestamp()
    });
    
    // 메시지 추가
    const messagesRef = collection(db, 'sessions', sessionId, 'messages');
    
    const messageData: Omit<Message, 'id'> = {
      sessionId,
      content,
      role,
      timestamp: serverTimestamp(),
      attachments: attachments || [] // undefined인 경우 빈 배열로 처리
    };
    
    const docRef = await addDoc(messagesRef, messageData);
    
    return {
      success: true,
      messageId: docRef.id
    };
  } catch (error: any) {
    console.error('메시지 추가 오류:', error);
    return {
      success: false,
      error: error.message || '메시지를 추가하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 세션의 메시지 목록 가져오기
 */
export const getSessionMessages = async (
  sessionId: string,
  limitCount = 50
): Promise<{ success: boolean; messages?: Message[]; error?: string }> => {
  try {
    const messagesRef = collection(db, 'sessions', sessionId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(limitCount));
    
    const querySnapshot = await getDocs(q);
    
    const messages: Message[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<Message, 'id'>;
      messages.push({
        ...data,
        id: doc.id
      });
    });
    
    return {
      success: true,
      messages
    };
  } catch (error: any) {
    console.error('메시지 목록 조회 오류:', error);
    return {
      success: false,
      error: error.message || '메시지 목록을 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 세션 삭제
 */
export const deleteSession = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 세션 존재 여부 확인
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) {
      return {
        success: false,
        error: '세션을 찾을 수 없습니다.'
      };
    }
    
    // 하위 메시지 컬렉션 확인
    const messagesRef = collection(db, 'sessions', sessionId, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    
    // 트랜잭션으로 메시지와 세션 함께 삭제
    if (!messagesSnap.empty) {
      // 하위 메시지 삭제
      const batch = writeBatch(db);
      messagesSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // 세션 문서 삭제
      batch.delete(sessionRef);
      
      // 일괄 처리 실행
      await batch.commit();
    } else {
      // 메시지가 없는 경우 세션 문서만 삭제
      await deleteDoc(sessionRef);
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('세션 삭제 오류:', error);
    return {
      success: false,
      error: error.message || '세션을 삭제하는 중 오류가 발생했습니다.'
    };
  }
}; 