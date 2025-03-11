'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getUserLearningPaths } from '@/lib/api/learningPath';
import { LearningPath } from '@/lib/api/learningPath';

export default function LearningPathsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 학습 경로 데이터 가져오기
  useEffect(() => {
    const fetchLearningPaths = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError('');
      
      try {
        const result = await getUserLearningPaths(user.uid);
        
        if (!result.success) {
          throw new Error(result.error || '학습 경로 목록을 가져오는 데 실패했습니다.');
        }
        
        setPaths(result.paths || []);
      } catch (error: any) {
        console.error('학습 경로 목록 가져오기 오류:', error);
        setError(error.message || '학습 경로 목록을 가져오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLearningPaths();
  }, [user]);

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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">학습 경로</h1>
        <Link
          href="/learning-path/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          새 학습 경로 생성
        </Link>
      </div>

      {paths.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
          <div className="text-5xl mb-4">🧠</div>
          <h2 className="text-2xl font-bold mb-2">아직 학습 경로가 없습니다</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            새로운 학습 경로를 생성하여 체계적인 학습을 시작해보세요.
          </p>
          <Link
            href="/learning-path/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            학습 경로 생성하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map((path) => (
            <LearningPathCard key={path.id} path={path} />
          ))}
        </div>
      )}
    </div>
  );
}

interface LearningPathCardProps {
  path: LearningPath;
}

function LearningPathCard({ path }: LearningPathCardProps) {
  const { id, title, description, subject, level, progress, steps } = path;
  
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
    <Link href={`/learning-path/${id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1 line-clamp-2">{title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                  {subject}
                </span>
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                  {getLevelText(level)}
                </span>
              </div>
            </div>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
            {description}
          </p>
          
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span>진행률</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            총 {steps.length}개 단계
          </div>
        </div>
      </div>
    </Link>
  );
} 