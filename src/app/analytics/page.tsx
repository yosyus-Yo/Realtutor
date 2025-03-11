'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getUserLearningAnalytics, LearningAnalytics, getUserAchievements, LearningAchievement } from '@/lib/api/analytics';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function AnalyticsPage() {
  const auth = useAuth();
  const { user, loading } = auth;
  const router = useRouter();
  
  const [analyticsData, setAnalyticsData] = useState<LearningAnalytics | null>(null);
  const [achievements, setAchievements] = useState<LearningAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'recommendations'>('overview');
  
  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);
  
  // 학습 분석 데이터 가져오기
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        // 학습 분석 데이터 가져오기
        const analyticsResult = await getUserLearningAnalytics(user.uid);
        
        if (!analyticsResult.success) {
          throw new Error(analyticsResult.error || '학습 분석 데이터를 가져오는 데 실패했습니다.');
        }
        
        // undefined 값이 할당되지 않도록 처리
        if (analyticsResult.analytics) {
          setAnalyticsData(analyticsResult.analytics);
        }
        
        // 학습 성취 목록 가져오기
        const achievementsResult = await getUserAchievements(user.uid);
        
        if (achievementsResult.success && achievementsResult.achievements) {
          setAchievements(achievementsResult.achievements);
        }
      } catch (error: any) {
        console.error('학습 분석 데이터 가져오기 오류:', error);
        setError(error.message || '학습 분석 데이터를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnalyticsData();
  }, [user]);
  
  // 포맷팅 및 계산 유틸리티 함수
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}분`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}시간`;
    }
    
    return `${hours}시간 ${remainingMinutes}분`;
  };
  
  if (loading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center p-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">학습 분석 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!analyticsData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center p-12">
          <h2 className="text-2xl font-bold mb-4 dark:text-white">학습 데이터가 없습니다</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">튜터링 세션이나 학습 경로를 완료하여 학습 데이터를 쌓아보세요.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">학습 분석</h1>
      
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            개요
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'achievements'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            학습 성취
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'recommendations'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            추천 학습
          </button>
        </nav>
      </div>
      
      {/* 개요 탭 */}
      {activeTab === 'overview' && (
        <div>
          {/* 학습 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">총 세션 완료</h3>
              <p className="text-3xl font-bold dark:text-white">{analyticsData.totalSessionsCompleted}</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">총 학습 시간</h3>
              <p className="text-3xl font-bold dark:text-white">{formatDuration(analyticsData.totalSessionDuration)}</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">학습 경로 진행도</h3>
              <p className="text-3xl font-bold dark:text-white">{analyticsData.completedSteps}단계</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">연속 학습일</h3>
              <p className="text-3xl font-bold dark:text-white">{analyticsData.learningStreak}일</p>
            </div>
          </div>
          
          {/* 주제별 학습 진행도 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">주제별 학습 진행도</h2>
            
            {Object.keys(analyticsData.progressBySubject).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analyticsData.progressBySubject).map(([subject, progress]) => (
                  <div key={subject}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium dark:text-gray-300">{subject}</span>
                      <span className="text-sm font-medium dark:text-gray-300">{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">아직 학습 진행 데이터가 없습니다.</p>
            )}
          </div>
          
          {/* 강점 및 개선 영역 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">강점</h2>
              
              {analyticsData.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {analyticsData.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 text-green-500 mr-2">✓</span>
                      <span className="dark:text-gray-300">{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">더 많은 학습을 통해 강점을 발견해 보세요.</p>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 dark:text-white">개선 영역</h2>
              
              {analyticsData.areasForImprovement.length > 0 ? (
                <ul className="space-y-2">
                  {analyticsData.areasForImprovement.map((area, index) => (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 h-5 w-5 text-blue-500 mr-2">→</span>
                      <span className="dark:text-gray-300">{area}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">현재 개선이 필요한 영역이 없습니다.</p>
              )}
            </div>
          </div>
          
          {/* 최근 활동 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">최근 활동</h2>
            
            {analyticsData.recentActivities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        활동 유형
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        날짜
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        상세 정보
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {analyticsData.recentActivities.map((activity) => {
                      const timestamp = activity.timestamp instanceof Date ? 
                        activity.timestamp : 
                        (activity.timestamp as any)?.toDate?.() || new Date();
                        
                      let activityTypeText = '';
                      let detailText = '';
                      
                      switch (activity.type) {
                        case 'session_start':
                          activityTypeText = '세션 시작';
                          detailText = `세션 ID: ${activity.details.sessionId}`;
                          break;
                        case 'session_complete':
                          activityTypeText = '세션 완료';
                          detailText = `세션 ID: ${activity.details.sessionId}`;
                          break;
                        case 'step_complete':
                          activityTypeText = '학습 단계 완료';
                          detailText = `경로: ${activity.details.pathId}, 단계: ${activity.details.stepId}`;
                          break;
                        case 'path_complete':
                          activityTypeText = '학습 경로 완료';
                          detailText = `경로 ID: ${activity.details.pathId}`;
                          break;
                        default:
                          activityTypeText = activity.type.replace('_', ' ');
                          break;
                      }
                      
                      return (
                        <tr key={activity.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {activityTypeText}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {format(timestamp, 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {detailText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">최근 활동 내역이 없습니다.</p>
            )}
          </div>
        </div>
      )}
      
      {/* 학습 성취 탭 */}
      {activeTab === 'achievements' && (
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-6 dark:text-white">학습 성취</h2>
            
            {achievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((achievement) => {
                  const earnedAt = achievement.earnedAt instanceof Date ? 
                    achievement.earnedAt : 
                    (achievement.earnedAt as any)?.toDate?.() || new Date();
                    
                  return (
                    <div key={achievement.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col">
                      <div className="flex items-center mb-4">
                        <div className="mr-4 text-3xl">{achievement.badge}</div>
                        <div>
                          <h3 className="font-semibold dark:text-white">{achievement.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {format(earnedAt, 'yyyy년 MM월 dd일', { locale: ko })}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm mb-2 dark:text-gray-300">{achievement.description}</p>
                      {achievement.relatedSubjects && achievement.relatedSubjects.length > 0 && (
                        <div className="mt-auto pt-2">
                          <div className="flex flex-wrap">
                            {achievement.relatedSubjects.map((subject, index) => (
                              <span key={index} className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs px-2 py-1 rounded mr-1 mb-1">
                                {subject}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">아직 획득한 학습 성취가 없습니다.</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">세션을 완료하고 학습 경로를 진행하여 성취를 획득해보세요.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 추천 학습 탭 */}
      {activeTab === 'recommendations' && (
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-6 dark:text-white">추천 학습</h2>
            
            <div className="mb-8">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">맞춤 추천</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analyticsData.areasForImprovement.map((area, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-sm mb-3 dark:text-gray-300">{area}</p>
                    <button
                      onClick={() => router.push('/learning-path')}
                      className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/30"
                    >
                      학습 경로 탐색
                    </button>
                  </div>
                ))}
                
                {analyticsData.areasForImprovement.length === 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 col-span-2">
                    <p className="text-sm mb-3 dark:text-gray-300">현재 학습 패턴을 기반으로 한 맞춤 추천 사항이 없습니다.</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">더 많은 학습 활동을 통해 개인화된 추천을 받아보세요.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">다음 단계 학습</h3>
              <div className="space-y-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-medium mb-2 dark:text-white">새로운 세션 시작하기</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    원하는 주제에 대한 새로운 튜터링 세션을 시작하여 심층적인 학습을 진행하세요.
                  </p>
                  <button
                    onClick={() => router.push('/session-selection')}
                    className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    새 세션 만들기
                  </button>
                </div>
                
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-medium mb-2 dark:text-white">학습 경로 생성하기</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    체계적인 학습을 위한 맞춤형 학습 경로를 생성하고 단계별로 진행하세요.
                  </p>
                  <button
                    onClick={() => router.push('/learning-path/new')}
                    className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    새 학습 경로 만들기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 