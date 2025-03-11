/**
 * RealTutor 학습 분석 및 성과 추적 API
 * 사용자의 학습 활동을 분석하고 성과를 추적하는 기능을 제공합니다.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  limit,
  increment,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateSessionSummary } from './gemini';

// 학습 활동 유형
export type LearningActivityType = 
  | 'session_start'
  | 'session_complete'
  | 'message_sent'
  | 'step_complete'
  | 'path_complete'
  | 'quiz_complete'
  | 'resource_viewed';

// 학습 활동 데이터 인터페이스
export interface LearningActivity {
  id?: string;
  userId: string;
  type: LearningActivityType;
  timestamp: Timestamp | Date;
  details: {
    sessionId?: string;
    pathId?: string;
    stepId?: string;
    resourceId?: string;
    quizId?: string;
    score?: number;
    duration?: number;
    messageCount?: number;
  };
}

// 학습 분석 결과 인터페이스
export interface LearningAnalytics {
  totalSessionsCompleted: number;
  totalSessionDuration: number;
  averageSessionDuration: number;
  totalMessagesExchanged: number;
  completedPaths: number;
  completedSteps: number;
  strengths: string[];
  areasForImprovement: string[];
  learningStreak: number;
  lastActivityDate: Date | null;
  subjectDistribution: Record<string, number>;
  progressBySubject: Record<string, number>;
  recentActivities: LearningActivity[];
}

// 학습 성취도 인터페이스
export interface LearningAchievement {
  id?: string;
  userId: string;
  title: string;
  description: string;
  earnedAt: Date | Timestamp;
  type: 'milestone' | 'skill' | 'engagement';
  badge: string;
  relatedSubjects?: string[];
}

/**
 * 학습 활동 기록
 */
export const recordLearningActivity = async (
  activity: Omit<LearningActivity, 'id' | 'timestamp'>
): Promise<{ success: boolean; activityId?: string; error?: string }> => {
  try {
    const activitiesRef = collection(db, 'learningActivities');
    
    const activityData = {
      ...activity,
      timestamp: serverTimestamp()
    };
    
    const docRef = await addDoc(activitiesRef, activityData);
    
    // 사용자의 학습 통계 업데이트
    await updateUserLearningStats(activity);
    
    return {
      success: true,
      activityId: docRef.id
    };
  } catch (error: any) {
    console.error('학습 활동 기록 오류:', error);
    return {
      success: false,
      error: error.message || '학습 활동을 기록하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 학습 통계 업데이트
 */
const updateUserLearningStats = async (activity: Omit<LearningActivity, 'id' | 'timestamp'>) => {
  try {
    const statsRef = doc(db, 'learningStats', activity.userId);
    const statsDoc = await getDoc(statsRef);
    
    const updateData: Record<string, any> = {};
    
    switch (activity.type) {
      case 'session_complete':
        updateData.sessionsCompleted = increment(1);
        if (activity.details.duration) {
          updateData.totalSessionDuration = increment(activity.details.duration);
        }
        updateData.lastSessionDate = serverTimestamp();
        break;
        
      case 'message_sent':
        updateData.totalMessages = increment(1);
        break;
        
      case 'step_complete':
        updateData.stepsCompleted = increment(1);
        break;
        
      case 'path_complete':
        updateData.pathsCompleted = increment(1);
        break;
        
      case 'quiz_complete':
        updateData.quizzesCompleted = increment(1);
        if (activity.details.score !== undefined) {
          updateData.quizScoresSum = increment(activity.details.score);
        }
        break;
    }
    
    // 마지막 활동 시간 업데이트
    updateData.lastActivityDate = serverTimestamp();
    
    // 학습 스트릭(연속 학습일) 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      const lastDate = data.lastActivityDate?.toDate();
      
      if (lastDate) {
        lastDate.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - lastDate.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        
        if (diffDays === 1) {
          // 어제 활동이 있었다면 스트릭 증가
          updateData.learningStreak = increment(1);
        } else if (diffDays > 1) {
          // 하루 이상 쉬었다면 스트릭 리셋
          updateData.learningStreak = 1;
        }
        // 같은 날이면 스트릭 유지
      } else {
        // 첫 활동이면 스트릭 1로 설정
        updateData.learningStreak = 1;
      }
      
      // 기존 문서 업데이트
      await updateDoc(statsRef, updateData);
    } else {
      // 문서가 없으면 새로 생성 (setDoc 사용)
      const initialData = {
        userId: activity.userId,
        sessionsCompleted: activity.type === 'session_complete' ? 1 : 0,
        stepsCompleted: activity.type === 'step_complete' ? 1 : 0,
        pathsCompleted: activity.type === 'path_complete' ? 1 : 0,
        totalMessages: activity.type === 'message_sent' ? 1 : 0,
        quizzesCompleted: activity.type === 'quiz_complete' ? 1 : 0,
        quizScoresSum: activity.type === 'quiz_complete' && activity.details.score !== undefined ? activity.details.score : 0,
        totalSessionDuration: activity.type === 'session_complete' && activity.details.duration ? activity.details.duration : 0,
        lastActivityDate: serverTimestamp(),
        lastSessionDate: activity.type === 'session_complete' ? serverTimestamp() : null,
        learningStreak: 1
      };
      
      // 새 문서 생성
      await setDoc(statsRef, initialData);
    }
  } catch (error) {
    console.error('학습 통계 업데이트 오류:', error);
    // 통계 업데이트 실패해도 활동 기록은 성공으로 처리
  }
};

/**
 * 사용자의 학습 분석 데이터 가져오기
 */
export const getUserLearningAnalytics = async (
  userId: string
): Promise<{ success: boolean; analytics?: LearningAnalytics; error?: string }> => {
  try {
    // 학습 통계 가져오기
    const statsRef = doc(db, 'learningStats', userId);
    const statsDoc = await getDoc(statsRef);
    
    if (!statsDoc.exists()) {
      return {
        success: true,
        analytics: {
          totalSessionsCompleted: 0,
          totalSessionDuration: 0,
          averageSessionDuration: 0,
          totalMessagesExchanged: 0,
          completedPaths: 0,
          completedSteps: 0,
          strengths: [],
          areasForImprovement: [],
          learningStreak: 0,
          lastActivityDate: null,
          subjectDistribution: {},
          progressBySubject: {},
          recentActivities: []
        }
      };
    }
    
    const statsData = statsDoc.data();
    
    // 최근 활동 가져오기
    const activitiesRef = collection(db, 'learningActivities');
    const activitiesQuery = query(
      activitiesRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    
    const activitiesSnapshot = await getDocs(activitiesQuery);
    const recentActivities = activitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LearningActivity[];
    
    // 주제별 분포 계산
    const subjectDistribution: Record<string, number> = {};
    const sessionsRef = collection(db, 'sessions');
    const sessionsQuery = query(
      sessionsRef,
      where('userId', '==', userId),
      where('isCompleted', '==', true)
    );
    
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      const subject = data.subject;
      
      if (subject) {
        subjectDistribution[subject] = (subjectDistribution[subject] || 0) + 1;
      }
    });
    
    // 과목별 진행도 계산
    const progressBySubject: Record<string, number> = {};
    const pathsRef = collection(db, 'learningPaths');
    const pathsQuery = query(
      pathsRef,
      where('userId', '==', userId)
    );
    
    const pathsSnapshot = await getDocs(pathsQuery);
    
    pathsSnapshot.forEach(doc => {
      const data = doc.data();
      const subject = data.subject;
      const steps = data.steps || [];
      const completedSteps = data.completedSteps || [];
      
      if (subject && steps.length > 0) {
        const progress = completedSteps.length / steps.length;
        progressBySubject[subject] = Math.max(progressBySubject[subject] || 0, progress);
      }
    });
    
    // 평균 세션 지속 시간 계산
    const averageSessionDuration = statsData.sessionsCompleted > 0
      ? statsData.totalSessionDuration / statsData.sessionsCompleted
      : 0;
    
    // 강점 및 개선 영역 생성 (실제 구현에서는 더 정교한 알고리즘 필요)
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];
    
    // 가장 많이 완료한 주제를 강점으로 추가
    if (Object.keys(subjectDistribution).length > 0) {
      const topSubject = Object.entries(subjectDistribution)
        .sort((a, b) => b[1] - a[1])[0][0];
      strengths.push(`${topSubject} 분야에 강점을 보입니다.`);
    }
    
    // 학습 연속일이 높으면 강점으로 추가
    if (statsData.learningStreak >= 7) {
      strengths.push(`꾸준한 학습 습관: ${statsData.learningStreak}일 연속 학습 중입니다.`);
    }
    
    // 진행도가 낮은 주제를 개선 영역으로 추가
    const lowProgressSubjects = Object.entries(progressBySubject)
      .filter(([_, progress]) => progress < 0.3)
      .map(([subject]) => subject);
    
    if (lowProgressSubjects.length > 0) {
      areasForImprovement.push(`${lowProgressSubjects.join(', ')} 분야의 학습 경로를 계속 진행해보세요.`);
    }
    
    // 세션 완료가 적으면 개선 영역으로 추가
    if (statsData.sessionsCompleted < 5) {
      areasForImprovement.push('더 많은 튜터링 세션을 완료하여 학습 효과를 높이세요.');
    }
    
    // 분석 결과 반환
    return {
      success: true,
      analytics: {
        totalSessionsCompleted: statsData.sessionsCompleted || 0,
        totalSessionDuration: statsData.totalSessionDuration || 0,
        averageSessionDuration,
        totalMessagesExchanged: statsData.totalMessages || 0,
        completedPaths: statsData.pathsCompleted || 0,
        completedSteps: statsData.stepsCompleted || 0,
        learningStreak: statsData.learningStreak || 0,
        lastActivityDate: statsData.lastActivityDate?.toDate() || null,
        strengths,
        areasForImprovement,
        subjectDistribution,
        progressBySubject,
        recentActivities
      }
    };
  } catch (error: any) {
    console.error('학습 분석 데이터 가져오기 오류:', error);
    return {
      success: false,
      error: error.message || '학습 분석 데이터를 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 학습 성취도 부여
 */
export const awardAchievement = async (
  achievement: Omit<LearningAchievement, 'id' | 'earnedAt'>
): Promise<{ success: boolean; achievementId?: string; error?: string }> => {
  try {
    // 이미 획득한 성취가 있는지 확인
    const achievementsRef = collection(db, 'achievements');
    const achievementQuery = query(
      achievementsRef,
      where('userId', '==', achievement.userId),
      where('title', '==', achievement.title)
    );
    
    const existingAchievements = await getDocs(achievementQuery);
    
    if (!existingAchievements.empty) {
      return {
        success: false,
        error: '이미 획득한 성취입니다.'
      };
    }
    
    // 새 성취 추가
    const newAchievement = {
      ...achievement,
      earnedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(achievementsRef, newAchievement);
    
    return {
      success: true,
      achievementId: docRef.id
    };
  } catch (error: any) {
    console.error('학습 성취 부여 오류:', error);
    return {
      success: false,
      error: error.message || '학습 성취를 부여하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 학습 성취 목록 가져오기
 */
export const getUserAchievements = async (
  userId: string
): Promise<{ success: boolean; achievements?: LearningAchievement[]; error?: string }> => {
  try {
    const achievementsRef = collection(db, 'achievements');
    const achievementsQuery = query(
      achievementsRef,
      where('userId', '==', userId),
      orderBy('earnedAt', 'desc')
    );
    
    const achievementsSnapshot = await getDocs(achievementsQuery);
    
    const achievements = achievementsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LearningAchievement[];
    
    return {
      success: true,
      achievements
    };
  } catch (error: any) {
    console.error('학습 성취 목록 가져오기 오류:', error);
    return {
      success: false,
      error: error.message || '학습 성취 목록을 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 세션 종료 후 학습 요약 및 분석 생성
 */
export const generateLearningSessionAnalysis = async (
  sessionId: string,
  userId: string
): Promise<{ success: boolean; summary?: string; recommendations?: string[]; error?: string }> => {
  try {
    // 세션 정보 가져오기
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) {
      return {
        success: false,
        error: '세션을 찾을 수 없습니다.'
      };
    }
    
    const sessionData = sessionDoc.data();
    
    // 세션 메시지 가져오기
    const messagesRef = collection(db, 'sessions', sessionId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
    const messagesSnapshot = await getDocs(messagesQuery);
    
    const messages = messagesSnapshot.docs.map(doc => ({
      ...doc.data()
    }));
    
    // 메시지 컨텐츠 추출
    const messageHistory = messages.map(msg => ({
      role: msg.role === 'tutor' ? 'model' as const : 'user' as const,
      content: msg.content
    }));
    
    // Gemini API로 학습 요약 생성
    const summaryResult = await generateSessionSummary(
      sessionData.subject,
      messageHistory
    );
    
    if (!summaryResult.success) {
      return {
        success: false,
        error: summaryResult.error || '학습 요약을 생성하는 데 실패했습니다.'
      };
    }
    
    // 학습 요약 저장
    await updateDoc(sessionRef, {
      summary: summaryResult.text,
      analysisTimestamp: serverTimestamp()
    });
    
    // 분석 결과에서 권장 사항 추출 (실제로는 더 정교한 알고리즘 필요)
    const summaryText = summaryResult.text || '';
    const recommendations = summaryText
      .split('\n')
      .filter(line => line.includes('추천') || line.includes('권장') || line.includes('제안'))
      .map(line => line.trim())
      .slice(0, 3);
    
    return {
      success: true,
      summary: summaryResult.text,
      recommendations: recommendations.length > 0 ? recommendations : [
        '관련 학습 경로를 계속 탐색해보세요.',
        '이 주제에 대한 추가 세션을 생성하여 학습을 심화하세요.',
        '실습 문제를 풀어보며 개념을 적용해보세요.'
      ]
    };
  } catch (error: any) {
    console.error('학습 세션 분석 오류:', error);
    return {
      success: false,
      error: error.message || '학습 세션을 분석하는 중 오류가 발생했습니다.'
    };
  }
}; 