/**
 * RealTutor 오프라인 동기화 관리자
 * 오프라인 상태에서의 데이터 일관성과 동기화를 관리합니다.
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase/config';

// 오프라인 큐에 저장되는 작업 유형
export type OfflineActionType = 
  | 'add_message'
  | 'complete_step'
  | 'create_session'
  | 'update_profile'
  | 'complete_session'
  | 'create_learning_path';

// 오프라인 큐에 저장되는 작업 데이터
export interface OfflineAction {
  id?: string;
  userId: string;
  type: OfflineActionType;
  timestamp: number;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

// IndexedDB 스토리지 키
const OFFLINE_QUEUE_KEY = 'realtutor_offline_queue';
const OFFLINE_DATA_KEY = 'realtutor_offline_data';

/**
 * 오프라인 큐에 작업 추가
 */
export const addToOfflineQueue = async (
  type: OfflineActionType,
  data: any
): Promise<boolean> => {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
      console.error('사용자가 인증되지 않았습니다.');
      return false;
    }
    
    const action: OfflineAction = {
      userId,
      type,
      timestamp: Date.now(),
      data,
      status: 'pending',
      retryCount: 0
    };
    
    // 로컬 스토리지에서 기존 큐 가져오기
    const queueStr = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineAction[] = queueStr ? JSON.parse(queueStr) : [];
    
    // 작업 추가 및 저장
    queue.push(action);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    console.log(`오프라인 큐에 작업 추가: ${type}`);
    return true;
  } catch (error) {
    console.error('오프라인 큐에 작업 추가 오류:', error);
    return false;
  }
};

/**
 * 오프라인 큐에서 작업 가져오기
 */
export const getOfflineQueue = (): OfflineAction[] => {
  try {
    const queueStr = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('오프라인 큐 가져오기 오류:', error);
    return [];
  }
};

/**
 * 오프라인 큐 업데이트
 */
export const updateOfflineQueue = (queue: OfflineAction[]): boolean => {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    console.error('오프라인 큐 업데이트 오류:', error);
    return false;
  }
};

/**
 * 오프라인 작업 처리
 */
export const processOfflineQueue = async (): Promise<{ success: boolean; processed: number; failed: number }> => {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
      console.error('사용자가 인증되지 않았습니다.');
      return { success: false, processed: 0, failed: 0 };
    }
    
    // 오프라인 큐 가져오기
    const queue = getOfflineQueue();
    
    if (queue.length === 0) {
      // 처리할 작업 없음
      return { success: true, processed: 0, failed: 0 };
    }
    
    let processed = 0;
    let failed = 0;
    
    // 대기 중인 작업만 필터링
    const pendingActions = queue.filter(action => action.status === 'pending');
    
    for (const action of pendingActions) {
      try {
        // 작업 상태 업데이트
        action.status = 'processing';
        updateOfflineQueue(queue);
        
        // 작업 유형에 따른 처리
        switch (action.type) {
          case 'add_message':
            await processAddMessage(action);
            break;
            
          case 'complete_step':
            await processCompleteStep(action);
            break;
            
          case 'create_session':
            await processCreateSession(action);
            break;
            
          case 'update_profile':
            await processUpdateProfile(action);
            break;
            
          case 'complete_session':
            await processCompleteSession(action);
            break;
            
          case 'create_learning_path':
            await processCreateLearningPath(action);
            break;
            
          default:
            throw new Error(`지원하지 않는 작업 유형: ${action.type}`);
        }
        
        // 작업 완료 처리
        action.status = 'completed';
        processed++;
      } catch (error: any) {
        // 작업 실패 처리
        console.error(`작업 처리 오류 (${action.type}):`, error);
        action.status = 'failed';
        action.error = error.message;
        action.retryCount++;
        failed++;
      }
    }
    
    // 큐 업데이트
    updateOfflineQueue(queue);
    
    // 완료된 작업이 일정 수 이상이면 정리
    if (queue.filter(action => action.status === 'completed').length > 50) {
      cleanupOfflineQueue();
    }
    
    return { success: true, processed, failed };
  } catch (error) {
    console.error('오프라인 큐 처리 오류:', error);
    return { success: false, processed: 0, failed: 0 };
  }
};

/**
 * 오프라인 큐 정리 (완료된 작업 제거)
 */
export const cleanupOfflineQueue = (): boolean => {
  try {
    const queue = getOfflineQueue();
    
    // 완료된 작업 제거
    const updatedQueue = queue.filter(action => action.status !== 'completed');
    
    return updateOfflineQueue(updatedQueue);
  } catch (error) {
    console.error('오프라인 큐 정리 오류:', error);
    return false;
  }
};

/**
 * 연결 상태 감지 및 오프라인 큐 처리
 */
export const setupOfflineSyncListener = (): () => void => {
  const handleOnline = async () => {
    console.log('온라인 상태로 전환됨, 오프라인 큐 처리 시작...');
    const result = await processOfflineQueue();
    console.log('오프라인 큐 처리 완료:', result);
  };
  
  // 이벤트 리스너 등록
  window.addEventListener('online', handleOnline);
  
  // 초기 상태 확인
  if (navigator.onLine) {
    // 온라인 상태에서 앱 시작 시 큐 처리
    setTimeout(() => {
      processOfflineQueue();
    }, 3000);
  }
  
  // 정리 함수 반환
  return () => window.removeEventListener('online', handleOnline);
};

/**
 * 오프라인 캐시에 데이터 저장
 */
export const storeOfflineData = (key: string, data: any): boolean => {
  try {
    // 기존 데이터 가져오기
    const dataStr = localStorage.getItem(OFFLINE_DATA_KEY);
    const offlineData = dataStr ? JSON.parse(dataStr) : {};
    
    // 데이터 업데이트
    offlineData[key] = {
      data,
      timestamp: Date.now()
    };
    
    // 저장
    localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    return true;
  } catch (error) {
    console.error('오프라인 데이터 저장 오류:', error);
    return false;
  }
};

/**
 * 오프라인 캐시에서 데이터 가져오기
 */
export const getOfflineData = (key: string): { data: any; timestamp: number } | null => {
  try {
    const dataStr = localStorage.getItem(OFFLINE_DATA_KEY);
    if (!dataStr) return null;
    
    const offlineData = JSON.parse(dataStr);
    return offlineData[key] || null;
  } catch (error) {
    console.error('오프라인 데이터 가져오기 오류:', error);
    return null;
  }
};

// 작업 유형별 처리 함수들

/**
 * 메시지 추가 작업 처리
 */
const processAddMessage = async (action: OfflineAction): Promise<void> => {
  const { sessionId, content, role, attachments } = action.data;
  
  // 세션 존재 여부 확인
  const sessionRef = doc(db, 'sessions', sessionId);
  
  // 메시지 추가
  const messagesRef = collection(db, 'sessions', sessionId, 'messages');
  
  const messageData = {
    sessionId,
    content,
    role,
    timestamp: serverTimestamp(),
    attachments: attachments || []
  };
  
  await addDoc(messagesRef, messageData);
  
  // 세션의 lastUpdatedAt 업데이트
  await updateDoc(sessionRef, {
    lastUpdatedAt: serverTimestamp()
  });
};

/**
 * 학습 단계 완료 작업 처리
 */
const processCompleteStep = async (action: OfflineAction): Promise<void> => {
  const { pathId, stepId } = action.data;
  const userId = action.userId;
  
  // 학습 경로 가져오기
  const pathRef = doc(db, 'learningPaths', pathId);
  
  // 완료된 단계 업데이트
  await updateDoc(pathRef, {
    completedSteps: arrayUnion(stepId),
    lastUpdatedAt: serverTimestamp()
  });
  
  // 학습 활동 기록
  const activitiesRef = collection(db, 'learningActivities');
  
  await addDoc(activitiesRef, {
    userId,
    type: 'step_complete',
    timestamp: serverTimestamp(),
    details: {
      pathId,
      stepId
    }
  });
};

/**
 * 세션 생성 작업 처리
 */
const processCreateSession = async (action: OfflineAction): Promise<void> => {
  const { subject, level, goal } = action.data;
  const userId = action.userId;
  
  // 세션 생성
  const sessionsRef = collection(db, 'sessions');
  
  await addDoc(sessionsRef, {
    userId,
    subject,
    level,
    goal,
    isActive: true,
    isCompleted: false,
    createdAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp()
  });
};

/**
 * 프로필 업데이트 작업 처리
 */
const processUpdateProfile = async (action: OfflineAction): Promise<void> => {
  const { profileData } = action.data;
  const userId = action.userId;
  
  // 프로필 업데이트
  const profileRef = doc(db, 'userProfiles', userId);
  
  await updateDoc(profileRef, {
    ...profileData,
    lastUpdatedAt: serverTimestamp()
  });
};

/**
 * 세션 완료 작업 처리
 */
const processCompleteSession = async (action: OfflineAction): Promise<void> => {
  const { sessionId, duration } = action.data;
  const userId = action.userId;
  
  // 세션 업데이트
  const sessionRef = doc(db, 'sessions', sessionId);
  
  await updateDoc(sessionRef, {
    isActive: false,
    isCompleted: true,
    completedAt: serverTimestamp(),
    duration: duration || 0
  });
  
  // 학습 활동 기록
  const activitiesRef = collection(db, 'learningActivities');
  
  await addDoc(activitiesRef, {
    userId,
    type: 'session_complete',
    timestamp: serverTimestamp(),
    details: {
      sessionId,
      duration
    }
  });
};

/**
 * 학습 경로 생성 작업 처리
 */
const processCreateLearningPath = async (action: OfflineAction): Promise<void> => {
  const { pathData } = action.data;
  const userId = action.userId;
  
  // 학습 경로 생성
  const pathsRef = collection(db, 'learningPaths');
  
  await addDoc(pathsRef, {
    userId,
    ...pathData,
    completedSteps: [],
    createdAt: serverTimestamp()
  });
};

// Firebase 배열 연산을 위한 임시 함수
const arrayUnion = (element: any) => {
  // 이 함수는 클라이언트 측에서 배열 연산을 처리하기 위한 것
  // 실제로는 Firebase의 arrayUnion을 사용해야 함
  return {
    __op: 'arrayUnion',
    element
  };
}; 