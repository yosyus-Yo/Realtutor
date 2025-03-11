'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getLearningPath, completeStep } from '@/lib/api/learningPath';
import { LearningPath, LearningStep } from '@/lib/api/learningPath';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getIdToken } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase/config';

export default function LearningPathDetailPage() {
  const auth = useAuth();
  const { user, loading } = auth;
  const router = useRouter();
  const params = useParams();
  const pathId = params.id as string;
  
  const [path, setPath] = useState<LearningPath | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 학습 경로 데이터 가져오기
  useEffect(() => {
    const fetchLearningPath = async () => {
      if (!pathId || !user) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        console.log(`학습 경로 데이터 요청: pathId=${pathId}, userId=${user.uid}`);
        
        // 권한 문제 해결을 위해 인증 토큰 갱신 시도
        try {
          // Firebase 토큰 직접 갱신
          const currentUser = firebaseAuth.currentUser;
          if (currentUser) {
            await getIdToken(currentUser, true);
            console.log('인증 토큰이 갱신되었습니다.');
          } else {
            console.warn('현재 사용자 정보를 찾을 수 없습니다.');
          }
        } catch (tokenError) {
          console.error('토큰 갱신 오류:', tokenError);
        }
        
        const result = await getLearningPath(pathId);
        
        if (!result.success || !result.path) {
          throw new Error(result.error || '학습 경로를 찾을 수 없습니다.');
        }
        
        // 현재 사용자의 학습 경로인지 확인
        if (result.path.userId !== user.uid) {
          console.error('학습 경로 소유자 불일치:', { 
            pathUserId: result.path.userId, 
            currentUserId: user.uid 
          });
          throw new Error('이 학습 경로에 접근할 권한이 없습니다.');
        }
        
        // 학습 자료가 없는 경우 보완
        const validatedPath = {
          ...result.path,
          steps: result.path.steps.map(step => {
            // 학습 자료가 없거나 빈 배열인 경우 기본 자료 제공
            if (!step.resources || step.resources.length === 0) {
              return {
                ...step,
                resources: [
                  {
                    id: `default-resource-${step.id}-1`,
                    title: '추천 학습 자료',
                    type: 'article' as const,
                    description: '이 단계에 필요한 학습 자료입니다.'
                  },
                  {
                    id: `default-resource-${step.id}-2`,
                    title: '추가 학습 자료',
                    type: 'video' as const,
                    description: '이 단계의 개념을 이해하는데 도움이 되는 영상입니다.'
                  }
                ]
              };
            }
            return step;
          })
        };
        
        console.log('학습 경로 데이터 로드 성공:', validatedPath);
        setPath(validatedPath);
        
        // 첫 번째 미완료 단계를 활성화
        const firstIncompleteStep = validatedPath.steps
          .sort((a, b) => a.order - b.order)
          .find(step => !step.isCompleted);
          
        if (firstIncompleteStep) {
          setActiveStepId(firstIncompleteStep.id);
        } else if (validatedPath.steps.length > 0) {
          // 모든 단계가 완료된 경우 마지막 단계 활성화
          const lastStep = [...validatedPath.steps].sort((a, b) => b.order - a.order)[0];
          setActiveStepId(lastStep.id);
        }
      } catch (error: any) {
        console.error('학습 경로 가져오기 오류:', error);
        
        // Firebase 권한 오류 판별 및 사용자 친화적 메시지로 변환
        if (error.message && error.message.includes('permission')) {
          setError('권한이 없습니다. 로그인 정보가 만료되었거나 이 학습 경로에 접근할 권한이 없습니다.');
        } else {
          setError(error.message || '학습 경로를 가져오는 중 오류가 발생했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (pathId && user) {
      fetchLearningPath();
    }
  }, [pathId, user, auth]);

  // 단계 완료 처리
  const handleCompleteStep = async (stepId: string) => {
    if (!path || isUpdating) return;
    
    setIsUpdating(true);
    
    try {
      const result = await completeStep(pathId, stepId);
      
      if (!result.success) {
        throw new Error(result.error || '단계를 완료 처리하는 데 실패했습니다.');
      }
      
      // 학습 경로 다시 가져오기
      const updatedPathResult = await getLearningPath(pathId);
      
      if (!updatedPathResult.success || !updatedPathResult.path) {
        throw new Error(updatedPathResult.error || '학습 경로를 가져오는 데 실패했습니다.');
      }
      
      setPath(updatedPathResult.path);
      
      // 다음 미완료 단계 찾기
      const currentStepIndex = updatedPathResult.path.steps.findIndex(step => step.id === stepId);
      const nextSteps = updatedPathResult.path.steps
        .sort((a, b) => a.order - b.order)
        .slice(currentStepIndex + 1)
        .filter(step => !step.isCompleted);
        
      if (nextSteps.length > 0) {
        setActiveStepId(nextSteps[0].id);
      }
    } catch (error: any) {
      console.error('단계 완료 처리 오류:', error);
      setError(error.message || '단계를 완료 처리하는 중 오류가 발생했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  // 로딩 중이거나 인증되지 않은 경우 로딩 표시
  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  // 오류 발생 시
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4">오류가 발생했습니다</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4">학습 경로를 찾을 수 없습니다</h2>
          <p>요청하신 학습 경로를 찾을 수 없습니다.</p>
          <Link href="/learning-path" className="mt-4 inline-block text-blue-600 hover:underline">
            학습 경로 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // 레벨 텍스트 변환
  const getLevelText = (level: string) => {
    switch (level) {
      case 'beginner':
        return '초급';
      case 'intermediate':
        return '중급';
      case 'advanced':
        return '고급';
      default:
        return level;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <Link href="/learning-path" className="text-blue-600 hover:underline inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          학습 경로 목록으로 돌아가기
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{path.title}</h1>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                {path.subject}
              </span>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                {getLevelText(path.level)}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{path.description}</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-w-[200px]">
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>진행률</span>
                <span>{path.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${path.progress}%` }}
                ></div>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {path.steps.filter(step => step.isCompleted).length}/{path.steps.length} 단계 완료
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 sticky top-8">
            <h2 className="text-xl font-bold mb-4">학습 단계</h2>
            <ul className="space-y-2">
              {path.steps
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <li key={step.id}>
                    <button
                      onClick={() => setActiveStepId(step.id)}
                      className={`w-full text-left p-3 rounded-lg flex items-center ${
                        activeStepId === step.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                        step.isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                      }`}>
                        {step.isCompleted ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          step.order
                        )}
                      </div>
                      <span className={step.isCompleted ? 'line-through opacity-70' : ''}>
                        {step.title}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
        
        <div className="md:col-span-2">
          {activeStepId && (
            <StepDetail
              step={path.steps.find(s => s.id === activeStepId)!}
              onComplete={handleCompleteStep}
              isUpdating={isUpdating}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface StepDetailProps {
  step: LearningStep;
  onComplete: (stepId: string) => void;
  isUpdating: boolean;
}

function StepDetail({ step, onComplete, isUpdating }: StepDetailProps) {
  const [resourceTypes, _] = useState({
    'article': '기사',
    'video': '비디오',
    'exercise': '연습 문제',
    'quiz': '퀴즈',
    'book': '도서',
    'website': '웹사이트',
    'document': '문서',
    'other': '기타'
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'article':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
            <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
          </svg>
        );
      case 'video':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        );
      case 'exercise':
      case 'quiz':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-2">{step.title}</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">{step.description}</p>
      
      {/* 학습 자료 섹션 */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">학습 자료</h3>
        <div className="space-y-4">
          {/* 안전하게 처리: resources가 있는 경우에만 map 실행 */}
          {step.resources && step.resources.length > 0 ? (
            step.resources.map((resource) => (
              <div key={resource.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="mr-3 mt-1">
                    {getResourceIcon(resource.type)}
                  </div>
                  <div>
                    <h4 className="font-medium">{resource.title}</h4>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {resourceTypes[resource.type] || resource.type}
                    </div>
                    {resource.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{resource.description}</p>
                    )}
                    {resource.url && (
                      <a 
                        href={resource.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-500 hover:text-blue-700 text-sm mt-2 inline-flex items-center"
                      >
                        자료 보기
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">이 단계에 대한 추가 학습 자료가 없습니다.</p>
          )}
        </div>
      </div>
      
      {/* 학습 콘텐츠 섹션 */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">학습 콘텐츠</h3>
        <div className="space-y-6">
          {step.materials && step.materials.length > 0 ? (
            step.materials.map((material, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium mb-2">{material.title}</h4>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {resourceTypes[material.type] || material.type}
                </div>
                
                {material.description && (
                  <p className="text-gray-700 dark:text-gray-300 mb-2">{material.description}</p>
                )}
                
                {material.url && (
                  <a 
                    href={material.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center text-blue-500 hover:text-blue-700 mt-2"
                  >
                    <span className="mr-1">{material.source || '외부 자료'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                )}
                
                {material.content && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: material.content }} />
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">이 단계에 대한 학습 콘텐츠가 준비 중입니다.</p>
          )}
        </div>
      </div>
      
      {/* 완료 버튼 */}
      <div className="mt-8">
        <button
          onClick={() => onComplete(step.id)}
          disabled={isUpdating || step.isCompleted}
          className={`px-4 py-2 rounded-md ${
            step.isCompleted
              ? 'bg-green-100 text-green-700 cursor-not-allowed'
              : isUpdating
                ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {step.isCompleted ? (
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              완료됨
            </span>
          ) : isUpdating ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              처리 중...
            </span>
          ) : (
            '단계 완료 표시'
          )}
        </button>
      </div>
    </div>
  );
} 