'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getUserSessions, deleteSession } from '@/lib/api/sessions';
import { getUserLearningPaths } from '@/lib/api/learningPath';
import { SessionData } from '@/lib/api/sessions';
import { LearningPath } from '@/lib/api/learningPath';

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  // 세션 완료율 계산
  const completionRate = recentSessions.length > 0
    ? Math.round((recentSessions.filter(s => !s.isActive).length / recentSessions.length) * 100)
    : 0;
  
  // 학습 경로 진행률 계산
  const pathProgress = paths.length > 0
    ? paths.reduce((acc, path) => {
        const totalSteps = path.steps.length;
        const completedSteps = path.steps.filter(step => step.isCompleted).length;
        return acc + (completedSteps / totalSteps);
      }, 0) / paths.length
    : 0;
  
  // 학습 주제별 세션 수 계산
  const subjectCounts = recentSessions.reduce((acc, session) => {
    const subject = session.subject.toLowerCase();
    acc[subject] = (acc[subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 상위 5개 주제 추출
  const topSubjects = Object.entries(subjectCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 데이터 가져오기
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        // 세션 데이터 가져오기
        const sessionsResult = await getUserSessions(user.uid);
        
        if (!sessionsResult.success) {
          throw new Error(sessionsResult.error || '세션 데이터를 가져오는 데 실패했습니다.');
        }
        
        // 최근 세션 5개만 표시
        const sortedSessions = (sessionsResult.sessions || []).sort((a, b) => {
          // Firestore Timestamp 타입 안전하게 처리
          const getTime = (timestamp: any) => {
            if (timestamp && typeof timestamp.toDate === 'function') {
              return timestamp.toDate().getTime();
            }
            return 0;
          };
          
          return getTime(b.lastUpdatedAt) - getTime(a.lastUpdatedAt);
        });
        
        setRecentSessions(sortedSessions.slice(0, 5));
        
        // 학습 경로 데이터 가져오기
        const pathsResult = await getUserLearningPaths(user.uid);
        
        if (!pathsResult.success) {
          throw new Error(pathsResult.error || '학습 경로 데이터를 가져오는 데 실패했습니다.');
        }
        
        setPaths(pathsResult.paths || []);
      } catch (error: any) {
        console.error('대시보드 데이터 가져오기 오류:', error);
        setError(error.message || '대시보드 데이터를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [user]);

  // 세션 삭제 처리 함수 추가
  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault(); // 링크 클릭 방지
    e.stopPropagation(); // 이벤트 버블링 방지
    setDeletingSession(sessionId);
    setDeleteError('');
  };

  // 세션 삭제 확인 함수 추가
  const confirmDelete = async () => {
    if (!deletingSession) return;
    
    setIsDeleting(true);
    setDeleteError('');
    
    try {
      const result = await deleteSession(deletingSession);
      
      if (!result.success) {
        throw new Error(result.error || '세션 삭제 중 오류가 발생했습니다.');
      }
      
      // 성공적으로 삭제됨 - 목록에서 제거
      setRecentSessions(recentSessions.filter(session => session.id !== deletingSession));
      setDeletingSession(null);
    } catch (error: any) {
      console.error('세션 삭제 오류:', error);
      setDeleteError(error.message || '세션 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 삭제 취소 함수 추가
  const cancelDelete = () => {
    setDeletingSession(null);
    setDeleteError('');
  };

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

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold mb-4">오류가 발생했습니다</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">대시보드</h1>
      
      {/* 퀵 액션 버튼 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link href="/session/new">
          <div className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 p-6 rounded-lg transition-colors dark:text-blue-300">
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-2">
              새 튜터링 세션
            </h3>
            <p className="text-blue-700 dark:text-blue-300">
              원하는 주제에 대해 새로운 튜터링 세션을 시작하세요.
            </p>
          </div>
        </Link>
        
        <Link href="/learning-path/new">
          <div className="bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/50 p-6 rounded-lg transition-colors dark:text-green-300">
            <h3 className="text-xl font-semibold text-green-700 dark:text-green-300 mb-2">
              학습 경로 생성
            </h3>
            <p className="text-green-700 dark:text-green-300">
              체계적인 학습을 위한 맞춤형 학습 경로를 생성하세요.
            </p>
          </div>
        </Link>
        
        <Link href="/session">
          <div className="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-800/50 p-6 rounded-lg transition-colors dark:text-indigo-300">
            <h3 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
              멀티모달 튜터링
            </h3>
            <p className="text-indigo-700 dark:text-indigo-300">
              음성, 화상, 화면 공유 기능을 활용한 향상된 학습 경험을 체험하세요.
            </p>
          </div>
        </Link>
      </div>
      
      {/* 환영 메시지 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold mb-2">안녕하세요, {profile?.displayName || user?.displayName || '학습자'}님!</h1>
        <p className="text-gray-600 dark:text-gray-300">오늘도 함께 학습을 시작해볼까요?</p>
      </div>
      
      {/* 학습 분석 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">학습 분석</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 세션 완료율 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">세션 완료율</h3>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold">{completionRate}%</div>
              <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* 학습 경로 진행도 */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">학습 경로 진행도</h3>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold">{Math.round(pathProgress * 100)}%</div>
              <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${pathProgress * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* 총 학습 시간 */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">총 세션 수</h3>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold">{recentSessions.length}</div>
              <div className="text-purple-500 text-lg">
                {recentSessions.length > 0 ? '진행 중' : '시작하기'}
              </div>
            </div>
          </div>
        </div>
        
        {/* 학습 주제 분포 */}
        {topSubjects.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3">주요 학습 주제</h3>
            <div className="space-y-2">
              {topSubjects.map(([subject, count]) => (
                <div key={subject} className="flex items-center">
                  <div className="w-32 truncate capitalize">{subject}</div>
                  <div className="flex-1 mx-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${(count / recentSessions.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 w-10 text-right">{count}회</div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-6">
          <Link href="/profile" className="text-blue-600 hover:underline text-sm">
            학습 설정 및 프로필 관리 &rarr;
          </Link>
        </div>
      </div>
      
      {/* 최근 세션 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">최근 학습 세션</h2>
          <Link href="/session" className="text-blue-600 hover:underline text-sm">
            모든 세션 보기 &rarr;
          </Link>
        </div>
        
        {recentSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">📚</div>
            <p className="mb-4">아직 학습 세션이 없습니다.</p>
            <Link 
              href="/session/new" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              첫 학습 세션 시작하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <Link 
                key={session.id} 
                href={`/session/${session.id}`}
                className="block p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium mb-1">{session.subject}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{session.goal}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      session.isActive 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {session.isActive ? '진행 중' : '완료됨'}
                    </span>
                    
                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => handleDeleteClick(session.id || '', e)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                      aria-label="세션 삭제"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        
        <div className="mt-4 text-center">
          <Link 
            href="/session/new" 
            className="inline-flex items-center text-blue-600 hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            새 학습 세션 시작
          </Link>
        </div>
      </div>
      
      {/* 학습 경로 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">학습 경로</h2>
          <Link href="/learning-path" className="text-blue-600 hover:underline text-sm">
            모든 학습 경로 보기 &rarr;
          </Link>
        </div>
        
        {paths.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">🧭</div>
            <p className="mb-4">아직 학습 경로가 없습니다.</p>
            <Link 
              href="/learning-path/new" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              맞춤형 학습 경로 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {paths.slice(0, 3).map((path) => {
              const totalSteps = path.steps.length;
              const completedSteps = path.steps.filter(step => step.isCompleted).length;
              const progress = Math.round((completedSteps / totalSteps) * 100);
              
              return (
                <Link 
                  key={path.id} 
                  href={`/learning-path/${path.id}`}
                  className="block p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="mb-2">
                    <h3 className="font-medium">{path.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{path.description}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {completedSteps}/{totalSteps} 완료
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        
        <div className="mt-4 text-center">
          <Link 
            href="/learning-path/new" 
            className="inline-flex items-center text-blue-600 hover:underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            새 학습 경로 만들기
          </Link>
        </div>
      </div>
      
      {/* 삭제 확인 모달 */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">세션 삭제 확인</h3>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              정말로 이 학습 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 관련 데이터가 영구적으로 삭제됩니다.
            </p>
            
            {deleteError && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded mb-4">
                {deleteError}
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isDeleting}
              >
                취소
              </button>
              
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    삭제 중...
                  </span>
                ) : (
                  '삭제'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 