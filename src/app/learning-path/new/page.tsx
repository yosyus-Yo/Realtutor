'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createLearningPath } from '@/lib/api/learningPath';

export default function NewLearningPathPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('beginner');
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 프로필에서 관심사 가져오기
  useEffect(() => {
    if (profile && profile.learningPreferences?.interests) {
      setInterests(profile.learningPreferences.interests);
    }
  }, [profile]);

  // 관심사 추가
  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  // 관심사 삭제
  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter(item => item !== interest));
  };

  // 학습 경로 생성
  const handleCreateLearningPath = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }
    
    if (!subject) {
      setError('학습 주제를 입력해주세요.');
      return;
    }
    
    setIsCreating(true);
    setError('');
    
    try {
      console.log(`학습 경로 생성 요청: 주제=${subject}, 레벨=${level}, 관심사=${interests.join(', ')}`);
      const result = await createLearningPath(user, subject, level, interests);
      
      if (!result.success || !result.pathId) {
        throw new Error(result.error || '학습 경로를 생성하는 데 실패했습니다.');
      }
      
      console.log(`학습 경로 생성 성공: ID=${result.pathId}`);
      // 생성된 학습 경로 페이지로 이동
      router.push(`/learning-path/${result.pathId}`);
    } catch (error: any) {
      console.error('학습 경로 생성 오류:', error);
      setError(`학습 경로 생성 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
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
        <Link href="/learning-path" className="text-blue-600 hover:underline inline-flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          학습 경로 목록으로 돌아가기
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6">새 학습 경로 생성</h1>
        
        {error && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleCreateLearningPath} className="space-y-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              학습 주제
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
            >
              <option value="beginner">초급</option>
              <option value="intermediate">중급</option>
              <option value="advanced">고급</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              관심 분야 (선택 사항)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {interests.map((interest, index) => (
                <div 
                  key={index}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full flex items-center"
                >
                  <span>{interest}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(interest)}
                    className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                placeholder="새 관심 분야 추가"
              />
              <button
                type="button"
                onClick={handleAddInterest}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors"
              >
                추가
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              관심 분야를 추가하면 더 맞춤화된 학습 경로를 생성할 수 있습니다.
            </p>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isCreating ? '학습 경로 생성 중...' : '학습 경로 생성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 