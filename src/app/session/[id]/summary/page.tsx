'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavbarClient from "@/components/common/NavbarClient";
import { useAuth } from '@/lib/hooks/useAuth';
import { getSession, getSessionMessages, completeSession } from '@/lib/api/sessions';
import { generateSessionSummary, generateLearningResources } from '@/lib/api/gemini';
import { SessionData, Message } from '@/lib/api/sessions';

export default function SessionSummaryPage({ params }: { params: { id: string } }) {
  const { user, loading, profile } = useAuth();
  const router = useRouter();
  const sessionId = params.id;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  // 세션 및 메시지 데이터 가져오기
  useEffect(() => {
    const fetchSessionData = async () => {
      if (!sessionId || !user) return;
      
      setIsFetchingData(true);
      setError('');
      
      try {
        // 세션 정보 가져오기
        const sessionResult = await getSession(sessionId);
        
        if (!sessionResult.success || !sessionResult.session) {
          throw new Error(sessionResult.error || '세션을 찾을 수 없습니다.');
        }
        
        // 현재 사용자의 세션인지 확인
        if (sessionResult.session.userId !== user.uid) {
          throw new Error('이 세션에 접근할 권한이 없습니다.');
        }
        
        setSession(sessionResult.session);
        
        // 이미 요약이 있는 경우 표시
        if (sessionResult.session.summary) {
          setSummary(sessionResult.session.summary);
        }
        
        // 메시지 목록 가져오기
        const messagesResult = await getSessionMessages(sessionId);
        
        if (!messagesResult.success) {
          throw new Error(messagesResult.error || '메시지를 가져오는 데 실패했습니다.');
        }
        
        setMessages(messagesResult.messages || []);
        
        // 요약이 없는 경우 자동 생성
        if (!sessionResult.session.summary && messagesResult.messages && messagesResult.messages.length > 0) {
          generateSummary(sessionResult.session.subject, messagesResult.messages);
        }
      } catch (error: any) {
        console.error('세션 데이터 가져오기 오류:', error);
        setError(error.message || '세션 데이터를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setIsFetchingData(false);
      }
    };
    
    fetchSessionData();
  }, [sessionId, user, router]);
  
  // 학습 추천 생성
  useEffect(() => {
    const generateRecommendations = async () => {
      if (!session || !user || !user.uid) return;
      
      try {
        // 학습 관심사 가져오기 (프로필에서)
        const interests: string[] = [];
        
        // 사용자 프로필에서 정보 가져오기 - profile을 useAuth 훅에서 추출
        if (profile && profile.learningPreferences && profile.learningPreferences.interests) {
          interests.push(...profile.learningPreferences.interests);
        }
        
        // 최근 주제 (현재 세션)
        const recentTopics = [session.subject];
        
        const recommendationsResult = await generateLearningResources(
          session.subject,
          session.level,
          interests,
          recentTopics
        );
        
        if (recommendationsResult.success && recommendationsResult.text) {
          setRecommendations(recommendationsResult.text);
        }
      } catch (error: any) {
        console.error('추천 생성 오류:', error);
      }
    };
    
    if (session && !recommendations) {
      generateRecommendations();
    }
  }, [session, user, recommendations, profile]);
  
  // 요약 생성 함수
  const generateSummary = async (subject: string, messages: Message[]) => {
    setIsGenerating(true);
    
    try {
      // 메시지 형식 변환
      const messageHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'tutor' as 'user' | 'tutor' | 'model',
        content: msg.content
      }));
      
      // Gemini API로 요약 생성
      const summaryResult = await generateSessionSummary(subject, messageHistory);
      
      if (!summaryResult.success) {
        throw new Error(summaryResult.error || '요약 생성에 실패했습니다.');
      }
      
      const generatedSummary = summaryResult.text || '';
      setSummary(generatedSummary);
      
      // 세션 완료 처리 및 요약 저장
      await completeSession(sessionId, generatedSummary);
      
      // 세션 정보 업데이트
      if (session) {
        setSession({
          ...session,
          summary: generatedSummary,
          isActive: false
        });
      }
    } catch (error: any) {
      console.error('요약 생성 오류:', error);
      setError(error.message || '요약을 생성하는 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // 로딩 중이거나 인증되지 않은 경우 로딩 표시
  if (loading || isFetchingData) {
    return (
      <>
        <NavbarClient />
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>로딩 중...</p>
          </div>
        </div>
      </>
    );
  }
  
  if (error) {
    return (
      <>
        <NavbarClient />
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link href="/dashboard" className="text-blue-600 hover:underline inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              대시보드로 돌아가기
            </Link>
          </div>
          
          <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-4">오류가 발생했습니다</h2>
            <p>{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NavbarClient />
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <Link href="/dashboard" className="text-blue-600 hover:underline inline-flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            대시보드로 돌아가기
          </Link>
          
          <Link href={`/session/${sessionId}`} className="text-blue-600 hover:underline">
            세션으로 돌아가기
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
            <h1 className="text-xl font-semibold">학습 세션 요약: {session?.subject}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              학습 수준: {session?.level === 'beginner' ? '초급' : session?.level === 'intermediate' ? '중급' : '고급'}
              {session?.goal && ` • 목표: ${session.goal}`}
            </p>
          </div>
          
          <div className="p-6">
            {isGenerating ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>학습 세션 요약 생성 중...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">세션 요약</h2>
                  <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg whitespace-pre-wrap">
                    {summary || "요약을 생성하는 중 문제가 발생했습니다."}
                  </div>
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold mb-4">학습 통계</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">총 메시지</p>
                      <p className="text-3xl font-bold">{messages.length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">나의 메시지</p>
                      <p className="text-3xl font-bold">{messages.filter(m => m.role === 'user').length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">튜터 메시지</p>
                      <p className="text-3xl font-bold">{messages.filter(m => m.role === 'tutor').length}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-4 bg-green-50 dark:bg-green-900/30 border-b border-green-100 dark:border-green-800">
            <h2 className="text-xl font-semibold">학습 추천</h2>
          </div>
          
          <div className="p-6">
            {!recommendations ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p>맞춤형 학습 추천 생성 중...</p>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">
                {recommendations}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-center mb-8">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            대시보드로 이동
          </Link>
        </div>
      </div>
    </>
  );
} 