// src/app/session/page.tsx 파일 생성
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSession, getSessionMessages, addMessage, completeSession } from '@/lib/api/sessions';
import { generateTutorResponse, generateSessionSummary } from '@/lib/api/gemini';
import { SessionData, Message } from '@/lib/api/sessions';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import MultimodalInput from '@/components/MultimodalInput';
import { MultimodalInput as MultimodalInputType, uploadImage, uploadAudio, processMultimodalMessage } from '@/lib/api/multimodal';
import { getIdToken } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase/config';

export default function SessionDetailPage() {
  const auth = useAuth();
  const { user, loading } = auth;
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMultimodalInput, setShowMultimodalInput] = useState(false);
  const [processingMultimodal, setProcessingMultimodal] = useState(false);
  const [showSummary, setShowSummary] = useState(false); // 요약본 표시 상태

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
      
      setIsLoading(true);
      setError('');
      
      try {
        console.log(`세션 데이터 요청: sessionId=${sessionId}, userId=${user.uid}`);
        
        // 권한 문제 해결을 위해 인증 토큰 갱신 시도
        try {
          const currentUser = firebaseAuth.currentUser;
          if (currentUser) {
            // Firebase 토큰 직접 갱신 요청
            await getIdToken(currentUser, true);
            console.log('인증 토큰이 갱신되었습니다.');
          } else {
            console.warn('현재 사용자 정보를 찾을 수 없습니다.');
          }
        } catch (tokenError) {
          console.error('토큰 갱신 오류:', tokenError);
        }
        
        // 세션 정보 가져오기
        const sessionResult = await getSession(sessionId);
        
        if (!sessionResult.success || !sessionResult.session) {
          throw new Error(sessionResult.error || '세션 정보를 가져오는 데 실패했습니다.');
        }
        
        // 세션 소유자 확인
        if (sessionResult.session.userId !== user.uid) {
          console.error('세션 소유자 불일치:', { 
            sessionUserId: sessionResult.session.userId, 
            currentUserId: user.uid 
          });
          throw new Error('이 세션에 접근할 권한이 없습니다.');
        }
        
        console.log('세션 데이터 로드 성공:', sessionResult.session);
        setSession(sessionResult.session);
        
        // 메시지 목록 가져오기 재시도 로직 추가
        let retryCount = 0;
        const maxRetries = 3;
        
        const fetchMessages = async (): Promise<void> => {
          try {
            console.log(`메시지 목록 가져오기 시도 #${retryCount + 1}`);
            const messagesResult = await getSessionMessages(sessionId);
            
            if (!messagesResult.success) {
              console.warn('메시지 목록 가져오기 실패:', messagesResult.error);
              // 재시도 횟수 초과 확인
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`메시지 목록 재시도 중... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
                return fetchMessages();
              } else {
                // 재시도 횟수 초과 시 빈 배열로 설정
                console.warn('최대 재시도 횟수 초과, 빈 메시지 목록으로 설정');
                setMessages([]);
              }
            } else {
              console.log(`메시지 ${messagesResult.messages?.length || 0}개 로드 성공`);
              setMessages(messagesResult.messages || []);
            }
          } catch (messageError: any) {
            console.error('메시지 로드 오류:', messageError);
            // 재시도 횟수 초과 확인
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`메시지 목록 재시도 중... (${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
              return fetchMessages();
            } else {
              // 메시지 로드 실패는 치명적이지 않으므로 계속 진행
              console.warn('최대 재시도 횟수 초과, 빈 메시지 목록으로 설정');
              setMessages([]);
            }
          }
        };
        
        // 메시지 목록 가져오기 시작
        await fetchMessages();
      } catch (error: any) {
        console.error('세션 데이터 가져오기 오류:', error);
        
        // Firebase 권한 오류 판별 및 사용자 친화적 메시지로 변환
        if (error.message && error.message.includes('permission')) {
          setError('권한이 없습니다. 로그인 정보가 만료되었거나 이 세션에 접근할 권한이 없습니다. 페이지를 새로고침하거나 다시 로그인해 보세요.');
        } else {
          setError(error.message || '세션 데이터를 가져오는 중 오류가 발생했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (sessionId && user) {
      fetchSessionData();
    }
  }, [sessionId, user, auth]);

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 전송 처리
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !session || isSending) return;
    
    setIsSending(true);
    
    try {
      // 권한 문제 해결을 위해 인증 토큰 갱신 시도
      try {
        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
          // Firebase 토큰 직접 갱신 요청
          await getIdToken(currentUser, true);
          console.log('메시지 전송 전 인증 토큰이 갱신되었습니다.');
        }
      } catch (tokenError) {
        console.error('토큰 갱신 오류:', tokenError);
      }
      
      // 사용자 메시지 추가 - undefined 필드 문제 해결
      const userMessageResult = await addMessage(
        sessionId, 
        newMessage, 
        'user',
        [] // 빈 배열로 attachments 전달하여 undefined 문제 해결
      );
      
      if (!userMessageResult.success) {
        throw new Error(userMessageResult.error || '메시지를 전송하는 데 실패했습니다.');
      }
      
      // 메시지 목록 업데이트
      const updatedMessages = [...messages, {
        id: userMessageResult.messageId,
        sessionId,
        content: newMessage,
        role: 'user' as const,
        timestamp: { toDate: () => new Date() } as any,
        attachments: [] // 빈 배열로 초기화
      }];
      
      setMessages(updatedMessages);
      setNewMessage('');
      
      // Gemini API를 통해 튜터 응답 생성
      const messageHistory = updatedMessages.map(msg => ({
        role: msg.role, // 'user' 또는 'tutor' 그대로 유지
        content: msg.content
      }));
      
      const responseResult = await generateTutorResponse(
        session.subject,
        session.level,
        messageHistory,
        newMessage
      );
      
      if (!responseResult.success) {
        throw new Error(responseResult.error || '튜터 응답을 생성하는 데 실패했습니다.');
      }
      
      // 튜터 응답 메시지 추가 - undefined 필드 문제 해결
      const tutorMessageResult = await addMessage(
        sessionId,
        responseResult.text || '',
        'tutor',
        [] // 빈 배열로 attachments 전달
      );
      
      if (!tutorMessageResult.success) {
        throw new Error(tutorMessageResult.error || '튜터 응답을 저장하는 데 실패했습니다.');
      }
      
      // 메시지 목록 다시 업데이트
      const messagesWithTutorResponse = [...updatedMessages, {
        id: tutorMessageResult.messageId,
        sessionId,
        content: responseResult.text || '',
        role: 'tutor' as const,
        timestamp: { toDate: () => new Date() } as any,
        attachments: [] // 빈 배열로 초기화
      }];
      
      setMessages(messagesWithTutorResponse);
    } catch (error: any) {
      console.error('메시지 전송 오류:', error);
      setError(error.message || '메시지를 전송하는 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // 세션 완료 처리
  const handleCompleteSession = async () => {
    if (!session || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    
    try {
      // 대화 내용을 바탕으로 세션 요약 생성
      const messageHistory = messages.map(msg => ({
        role: msg.role === 'tutor' ? 'model' as const : 'user' as const,
        content: msg.content
      }));
      
      const summaryResult = await generateSessionSummary(
        session.subject,
        messageHistory
      );
      
      if (!summaryResult.success) {
        throw new Error(summaryResult.error || '세션 요약을 생성하는 데 실패했습니다.');
      }
      
      // 세션 완료 상태로 업데이트
      const completeResult = await completeSession(
        sessionId,
        summaryResult.text
      );
      
      if (!completeResult.success) {
        throw new Error(completeResult.error || '세션을 완료하는 데 실패했습니다.');
      }
      
      // 세션 상태 업데이트
      setSession({
        ...session,
        isActive: false,
        summary: summaryResult.text
      });
      
    } catch (error: any) {
      console.error('세션 완료 오류:', error);
      setError(error.message || '세션을 완료하는 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 타임스탬프 포맷팅
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return '';
    
    const date = timestamp.toDate();
    return formatDistanceToNow(date, { addSuffix: true, locale: ko });
  };

  // 레벨 텍스트 변환
  const getLevelText = (level: string) => {
    switch (level) {
      case 'beginner': return '초급';
      case 'intermediate': return '중급';
      case 'advanced': return '고급';
      default: return level;
    }
  };

  // 멀티모달 처리 함수 추가
  const handleMultimodalSubmit = async (input: MultimodalInputType) => {
    if (!session || processingMultimodal) return;
    
    setProcessingMultimodal(true);
    setShowMultimodalInput(false);
    setError('');
    
    try {
      // 권한 문제 해결을 위해 인증 토큰 갱신 시도
      try {
        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
          // Firebase 토큰 직접 갱신 요청
          await getIdToken(currentUser, true);
        }
      } catch (tokenError) {
        console.error('토큰 갱신 오류:', tokenError);
      }
      
      // 텍스트 메시지
      const textContent = newMessage.trim() 
        ? newMessage
        : input.type === 'image' 
          ? '이 이미지에 대해 설명해주세요.'
          : '이 오디오를 분석해주세요.';
      
      // 파일 업로드
      let uploadResult;
      
      if (input.type === 'image') {
        uploadResult = await uploadImage(input.file, sessionId);
      } else if (input.type === 'audio') {
        uploadResult = await uploadAudio(input.file, sessionId);
      } else {
        throw new Error('지원하지 않는 파일 형식입니다.');
      }
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || '파일 업로드에 실패했습니다.');
      }
      
      // 사용자 메시지에 파일 첨부
      const attachments = [{
        type: input.type,
        url: uploadResult.url,
        mimeType: input.mimeType
      }];
      
      // 사용자 메시지 추가 - 파일 첨부
      const userMessageResult = await addMessage(
        sessionId, 
        textContent, 
        'user',
        attachments
      );
      
      if (!userMessageResult.success) {
        throw new Error(userMessageResult.error || '메시지를 전송하는 데 실패했습니다.');
      }
      
      // 메시지 목록 업데이트
      const updatedMessages = [...messages, {
        id: userMessageResult.messageId,
        sessionId,
        content: textContent,
        role: 'user' as const,
        timestamp: { toDate: () => new Date() } as any,
        attachments
      }];
      
      setMessages(updatedMessages);
      setNewMessage('');
      
      // Gemini API를 통해 멀티모달 처리 및 튜터 응답 생성
      const messageHistory = updatedMessages.map(msg => ({
        role: msg.role, // 'user' 또는 'tutor' 그대로 유지
        content: msg.content
      }));
      
      // 멀티모달 처리
      const responseResult = await processMultimodalMessage(
        sessionId,
        session.subject,
        session.level,
        messageHistory,
        textContent,
        input
      );
      
      if (!responseResult.success) {
        throw new Error(responseResult.error || '튜터 응답을 생성하는 데 실패했습니다.');
      }
      
      // 튜터 응답 메시지 추가
      const tutorMessageResult = await addMessage(
        sessionId,
        responseResult.text || '',
        'tutor',
        []
      );
      
      if (!tutorMessageResult.success) {
        throw new Error(tutorMessageResult.error || '튜터 응답을 저장하는 데 실패했습니다.');
      }
      
      // 메시지 목록 다시 업데이트
      const messagesWithTutorResponse = [...updatedMessages, {
        id: tutorMessageResult.messageId,
        sessionId,
        content: responseResult.text || '',
        role: 'tutor' as const,
        timestamp: { toDate: () => new Date() } as any,
        attachments: []
      }];
      
      setMessages(messagesWithTutorResponse);
    } catch (error: any) {
      console.error('멀티모달 메시지 처리 오류:', error);
      setError(error.message || '멀티모달 메시지를 처리하는 중 오류가 발생했습니다.');
    } finally {
      setProcessingMultimodal(false);
    }
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
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-md mb-4">
            <p>오류 발생: {error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <p>세션 정보를 찾을 수 없습니다.</p>
          <Link href="/session" className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            세션 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* 세션 정보 헤더 */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{session.subject}</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {getLevelText(session.level)} 레벨 • {formatTimestamp(session.createdAt)}
              {!session.isActive && ' • 완료됨'}
            </div>
          </div>
          <div className="space-x-2">
            <Link 
              href="/session" 
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              목록으로
            </Link>
            {session.isActive && (
              <button
                onClick={handleCompleteSession}
                disabled={isGeneratingSummary}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isGeneratingSummary ? '완료 중...' : '세션 완료'}
              </button>
            )}
            {!session.isActive && session.summary && (
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                요약 보기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 요약본 모달 */}
      {showSummary && session.summary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">📝 세션 요약</h3>
              <button 
                onClick={() => setShowSummary(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="p-6 whitespace-pre-line">
              {session.summary}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button 
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-md p-4 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            아직 대화가 없습니다. 첫 메시지를 보내보세요!
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-black dark:text-white'
                  }`}
                >
                  <div className="whitespace-pre-line">{message.content}</div>
                  <div 
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 메시지 입력 폼 */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        {!session.isActive && session.summary && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              세션 요약 보기
            </button>
          </div>
        )}
        
        {showMultimodalInput && (
          <MultimodalInput
            sessionId={sessionId}
            onFileSelect={handleMultimodalSubmit}
            onCancel={() => setShowMultimodalInput(false)}
          />
        )}
        
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setShowMultimodalInput(true)}
            className="p-2 text-gray-500 hover:text-blue-500 focus:outline-none"
            disabled={isSending || processingMultimodal || !session.isActive}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={session.isActive ? "메시지를 입력하세요..." : "세션이 완료되었습니다."}
            className="flex-1 p-2 border rounded-l"
            disabled={isSending || processingMultimodal || !session.isActive}
          />
          
          <button
            type="submit"
            className={`p-2 rounded-r ${
              isSending || processingMultimodal || !newMessage.trim() || !session.isActive
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
            disabled={isSending || processingMultimodal || !newMessage.trim() || !session.isActive}
          >
            {isSending || processingMultimodal ? (
              // 로딩 스피너
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              // 전송 아이콘
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}