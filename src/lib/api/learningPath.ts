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
  serverTimestamp,
  Timestamp,
  FieldValue
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from 'firebase/auth';
import { generateLearningPath } from './gemini';

// 학습 경로 타입
export interface LearningPath {
  id: string;
  userId: string;
  subject: string;
  level: string;
  title: string;
  description: string;
  steps: LearningStep[];
  completedSteps?: string[];
  createdAt: Date;
  lastUpdatedAt?: Date | null;
  isCompleted?: boolean;
  progress?: number; // 0-100 진행률
}

// 학습 단계 타입
export interface LearningStep {
  id: string;
  title: string;
  description: string;
  resources?: LearningResource[];
  materials?: LearningMaterial[];
  isCompleted?: boolean;
  order: number;
}

// 학습 자료 타입
export interface LearningResource {
  id: string;
  title: string;
  type: 'article' | 'video' | 'exercise' | 'quiz' | 'book' | 'other';
  url?: string;
  description?: string;
}

// 학습 자료 타입 (확장)
export interface LearningMaterial {
  title: string;
  type: 'article' | 'video' | 'website' | 'document' | 'exercise' | 'quiz';
  description?: string;
  url?: string;
  source?: string;
  content?: string;
}

// 서버 데이터 타입 (Firestore 문서에서 직접 가져온 데이터)
export interface LearningPathData {
  userId: string;
  subject: string;
  level: string;
  title: string;
  description: string;
  steps: LearningStepData[];
  completedSteps?: string[];
  createdAt: Timestamp | FieldValue;
  lastUpdatedAt?: Timestamp | FieldValue | null;
  isCompleted?: boolean;
  progress?: number;
}

// 서버에서 사용하는 학습 단계 데이터 타입
export interface LearningStepData {
  id: string;
  title: string;
  description: string;
  resources?: LearningResource[];
  materials?: LearningMaterialData[];
  isCompleted?: boolean;
  order: number;
}

// 서버에서 사용하는 학습 자료 데이터 타입
export interface LearningMaterialData {
  title: string;
  type: string;
  description?: string;
  url?: string;
  source?: string;
  content?: string;
}

/**
 * 새 학습 경로 생성
 */
export const createLearningPath = async (
  user: User,
  subject: string,
  level: string,
  interests: string[] = []
): Promise<{ success: boolean; pathId?: string; error?: string }> => {
  try {
    const generateResult = await generateLearningPath(subject, level, interests);
    
    if (!generateResult.success || !generateResult.path) {
      return {
        success: false,
        error: generateResult.error || '학습 경로를 생성하는 데 실패했습니다.'
      };
    }
    
    const { title, description, steps } = generateResult.path;
    
    // 학습 경로 데이터 준비
    const pathData: Omit<LearningPathData, 'userId'> = {
      subject,
      level,
      title,
      description,
      steps,
      completedSteps: [],
      createdAt: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
      isCompleted: false,
      progress: 0
    };
    
    // Firestore에 저장
    const pathsRef = collection(db, 'learningPaths');
    const docRef = await addDoc(pathsRef, {
      ...pathData,
      userId: user.uid
    });
    
    return {
      success: true,
      pathId: docRef.id
    };
  } catch (error: any) {
    console.error('학습 경로 생성 오류:', error);
    return {
      success: false,
      error: error.message || '학습 경로를 생성하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 사용자의 학습 경로 목록 가져오기
 */
export const getUserLearningPaths = async (userId: string): Promise<{ success: boolean; paths?: LearningPath[]; error?: string }> => {
  try {
    const pathsRef = collection(db, 'learningPaths');
    
    // Firestore 인덱스 오류를 방지하기 위한 쿼리 전략
    let q;
    try {
      // 복합 쿼리 시도 (인덱스가 있는 경우)
      q = query(
        pathsRef,
        where('userId', '==', userId),
        orderBy('lastUpdatedAt', 'desc')
      );
    } catch (indexError) {
      console.warn('복합 쿼리에 필요한 인덱스가 없습니다. 대체 쿼리 사용:', indexError);
      // 인덱스가 없는 경우 간단한 쿼리로 대체
      q = query(
        pathsRef,
        where('userId', '==', userId)
      );
    }
    
    try {
      const querySnapshot = await getDocs(q);
      
      let paths: LearningPath[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<LearningPath, 'id'>;
        paths.push({
          ...data,
          id: doc.id
        });
      });
      
      // 인덱스가 없는 경우 클라이언트 측에서 정렬
      if (!q.toString().includes('orderBy')) {
        paths = paths.sort((a, b) => {
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
        paths
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
    console.error('학습 경로 목록 조회 오류:', error);
    return {
      success: false,
      error: error.message || '학습 경로 목록을 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 학습 경로 정보 가져오기
 */
export const getLearningPath = async (
  pathId: string
): Promise<{ success: boolean; path?: LearningPath; error?: string }> => {
  try {
    // 학습 경로 문서 가져오기
    const pathRef = doc(db, 'learningPaths', pathId);
    const pathDoc = await getDoc(pathRef);
    
    if (!pathDoc.exists()) {
      return {
        success: false,
        error: '학습 경로를 찾을 수 없습니다.'
      };
    }
    
    const pathData = pathDoc.data() as LearningPathData;
    
    // 학습 자료 확인 및 기본 자료 추가
    const steps = pathData.steps || [];
    let hasChanges = false;
    
    const updatedSteps: LearningStepData[] = steps.map((step: LearningStepData) => {
      // 학습 자료가 없거나 비어있는 경우 기본 자료 추가
      if (!step.materials || step.materials.length === 0) {
        hasChanges = true;
        
        // Storage 사용 없이 외부 링크와 텍스트 기반 자료만 제공
        return {
          ...step,
          materials: [
            {
              title: `${step.title}에 대한 기본 학습 자료`,
              type: 'article', // 명시적으로 허용된 타입 사용
              description: '이 자료는 해당 주제에 대한 기본적인 정보를 담고 있습니다.',
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(step.title)}`,
              source: 'Wikipedia'
            },
            {
              title: `${step.title} 학습 가이드`,
              type: 'website', // 명시적으로 허용된 타입 사용
              description: '해당 주제에 대한 추가 학습 자료입니다.',
              url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(step.title)}`,
              source: 'Khan Academy'
            }
          ]
        };
      }
      
      return step;
    });
    
    // 변경된 부분이 있으면 업데이트
    if (hasChanges) {
      await updateDoc(pathRef, {
        steps: updatedSteps
      });
    }
    
    // Firestore 데이터를 클라이언트 모델로 변환
    const createdAt = pathData.createdAt instanceof Timestamp 
      ? pathData.createdAt.toDate() 
      : new Date();
      
    const lastUpdatedAt = pathData.lastUpdatedAt instanceof Timestamp
      ? pathData.lastUpdatedAt.toDate()
      : null;
    
    // 서버 데이터를 클라이언트 타입으로 변환
    const convertedSteps: LearningStep[] = updatedSteps.map(stepData => {
      const convertedMaterials = stepData.materials?.map(material => ({
        title: material.title,
        type: material.type as 'article' | 'video' | 'website' | 'document' | 'exercise' | 'quiz',
        description: material.description,
        url: material.url,
        source: material.source,
        content: material.content
      })) || [];
      
      return {
        id: stepData.id,
        title: stepData.title,
        description: stepData.description,
        resources: stepData.resources || [],
        materials: convertedMaterials,
        isCompleted: stepData.isCompleted || false,
        order: stepData.order
      };
    });
    
    const path: LearningPath = {
      id: pathDoc.id,
      userId: pathData.userId,
      subject: pathData.subject,
      level: pathData.level,
      title: pathData.title,
      description: pathData.description,
      steps: convertedSteps,
      completedSteps: pathData.completedSteps || [],
      createdAt,
      lastUpdatedAt,
      isCompleted: pathData.isCompleted || false,
      progress: pathData.progress || 0
    };
    
    return {
      success: true,
      path
    };
  } catch (error: any) {
    console.error('학습 경로 가져오기 오류:', error);
    return {
      success: false,
      error: error.message || '학습 경로를 가져오는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 학습 단계 완료 처리
 */
export const completeStep = async (
  pathId: string,
  stepId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 현재 학습 경로 가져오기
    const pathResult = await getLearningPath(pathId);
    
    if (!pathResult.success || !pathResult.path) {
      throw new Error(pathResult.error || '학습 경로를 찾을 수 없습니다.');
    }
    
    const path = pathResult.path;
    
    // 단계 업데이트
    const updatedSteps = path.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, isCompleted: true };
      }
      return step;
    });
    
    // 진행률 계산
    const completedSteps = updatedSteps.filter(step => step.isCompleted).length;
    const totalSteps = updatedSteps.length;
    const progress = Math.round((completedSteps / totalSteps) * 100);
    
    // 모든 단계가 완료되었는지 확인
    const isCompleted = completedSteps === totalSteps;
    
    // Firestore 업데이트
    const pathRef = doc(db, 'learningPaths', pathId);
    
    await updateDoc(pathRef, {
      steps: updatedSteps,
      progress,
      isCompleted,
      lastUpdatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('학습 단계 완료 처리 오류:', error);
    return {
      success: false,
      error: error.message || '학습 단계를 완료 처리하는 중 오류가 발생했습니다.'
    };
  }
}; 