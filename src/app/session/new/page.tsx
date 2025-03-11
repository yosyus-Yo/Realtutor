'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createSession } from '@/lib/api/sessions';
import { startTutoringSession } from '@/lib/api/gemini';
import { addMessage } from '@/lib/api/sessions';
import { saveMultimodalSessionInfo } from '@/lib/utils/localStorage';

type InteractionMode = 'text' | 'voice' | 'visual';

export default function NewSession() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('beginner');
  const [goal, setGoal] = useState('');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('text');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  if (!loading && !user) {
    router.push('/login');
    return null;
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }
    
    if (!subject || !goal) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    
    setIsCreating(true);
    setError('');
    
    try {
      // 상호작용 모드에 따라 다른 처리
      switch (interactionMode) {
        case 'voice':
          // 음성 모드는 멀티모달 튜터링 세션으로 리디렉션
          // 세션 정보를 로컬 스토리지에 저장
          saveMultimodalSessionInfo({
            subject,
            level,
            goal
          });
          router.push('/session');
          return;
        
        case 'visual':
          // 시각 모드도 멀티모달 튜터링 세션으로 리디렉션
          // 세션 정보를 로컬 스토리지에 저장
          saveMultimodalSessionInfo({
            subject,
            level,
            goal
          });
          router.push('/session');
          return;
          
        case 'text':
          // 텍스트 모드는 기존 방식대로 세션 생성
          // 1. Firestore에 세션 생성
          const result = await createSession(
            user,
            subject,
            level,
            goal,
            interactionMode
          );
          
          if (!result.success || !result.sessionId) {
            throw new Error(result.error || '세션 생성에 실패했습니다.');
          }
          
          // 2. Gemini API를 사용하여 첫 튜터 메시지 생성
          const sessionId = result.sessionId;
          const tutorResponse = await startTutoringSession(subject, level, goal);
          
          if (!tutorResponse.success) {
            throw new Error(tutorResponse.error || '튜터 응답 생성에 실패했습니다.');
          }
          
          // 3. 첫 튜터 메시지를 Firestore에 저장
          const messageResult = await addMessage(
            sessionId,
            tutorResponse.text || '안녕하세요! 학습을 시작하겠습니다.',
            'tutor',
            []
          );
          
          if (!messageResult.success) {
            throw new Error(messageResult.error || '메시지 저장에 실패했습니다.');
          }
          
          // 4. 세션 페이지로 리디렉션
          router.push(`/session/${sessionId}`);
          break;
      }
    } catch (error: any) {
      console.error('세션 생성 오류:', error);
      setError(error.message || '세션을 생성하는 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // 로딩 중이거나 인증되지 않은 경우 로딩 표시
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          대시보드로 돌아가기
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6 dark:text-white">새 학습 세션 시작</h1>
        
        {error && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleCreateSession} className="space-y-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              학습 주제
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="예: 미분적분학, 파이썬 프로그래밍, 영어 문법 등"
              required
            />
          </div>
          
          <div>
            <label htmlFor="level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              학습 수준
            </label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="beginner">초급</option>
              <option value="intermediate">중급</option>
              <option value="advanced">고급</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="goal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              학습 목표
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="이번 세션에서 배우고 싶은 내용을 자세히 설명해주세요."
              required
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상호작용 모드
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InteractionModeButton
                icon="💬"
                name="text"
                label="텍스트"
                description="텍스트로 AI 튜터와 대화하는 일반 세션입니다."
                selected={interactionMode === 'text'}
                onClick={() => setInteractionMode('text')}
              />
              <InteractionModeButton
                icon="🎤"
                name="voice"
                label="음성"
                description="음성으로 AI 튜터와 대화하는 멀티모달 세션입니다."
                selected={interactionMode === 'voice'}
                onClick={() => setInteractionMode('voice')}
              />
              <InteractionModeButton
                icon="📷"
                name="visual"
                label="이미지/화면"
                description="화면 공유와 화상으로 AI 튜터와 소통하는 멀티모달 세션입니다."
                selected={interactionMode === 'visual'}
                onClick={() => setInteractionMode('visual')}
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {isCreating ? '세션 생성 중...' : `${
                interactionMode === 'text' ? '텍스트 기반 학습 세션 시작하기' :
                interactionMode === 'voice' ? '음성 기반 멀티모달 세션 시작하기' :
                '화상/화면 공유 멀티모달 세션 시작하기'
              }`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface InteractionModeButtonProps {
  icon: string;
  name: string;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function InteractionModeButton({ 
  icon, 
  name, 
  label, 
  description,
  selected,
  onClick
}: InteractionModeButtonProps) {
  return (
    <label 
      className={`flex flex-col p-4 rounded-lg cursor-pointer border-2 transition-all ${
        selected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <input
        type="radio"
        name="interaction-mode"
        value={name}
        className="hidden"
        checked={selected}
        onChange={() => {}}
      />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold dark:text-white">{label}</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300">{description}</p>
    </label>
  );
} 