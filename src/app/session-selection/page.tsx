'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

export default function SessionSelectionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 로딩 중이거나 인증되지 않은 경우 로딩 UI 표시
  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-900 text-gray-200">
        <div className="w-full max-w-4xl">
          <h1 className="text-2xl font-bold mb-4">세션 로딩 중...</h1>
          <p className="text-gray-400 mb-8">잠시만 기다려주세요.</p>
          <div className="w-24 h-1 bg-blue-500 relative">
            <div className="absolute top-0 left-0 h-1 bg-blue-500 animate-loading-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-gray-200">
      <div className="w-full max-w-6xl">
        <h1 className="text-4xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          학습 세션 선택
        </h1>
        <p className="text-gray-400 text-center mb-12 text-lg">
          학습 목표와 선호하는 방식에 맞는 튜터링 세션을 선택하세요.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* 새 튜터링 세션 카드 */}
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:border-blue-500 transition-all duration-300 hover:shadow-blue-900/20 overflow-hidden group">
            <div className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl mr-4">
                  <span>💬</span>
                </div>
                <h2 className="text-2xl font-bold text-blue-300 group-hover:text-blue-200 transition-colors">
                  새 튜터링 세션
                </h2>
              </div>

              <p className="text-gray-300 mb-6">
                텍스트 기반의 새로운 튜터링 세션을 시작합니다. 특정 주제에 대해 학습하고, 질문하고, 지식을 얻을 수 있습니다.
              </p>

              <div className="bg-gray-700/50 p-5 rounded-lg mb-6">
                <h3 className="font-semibold text-blue-300 mb-3">주요 특징:</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    주제와 난이도 설정
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    텍스트 기반 대화
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    코드 및 이미지 첨부 가능
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    세션 내역 저장 및 검색
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link 
                  href="/session/new"
                  className="block w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-center transition-colors"
                >
                  텍스트 기반 세션 시작하기
                </Link>
              </div>
            </div>
          </div>

          {/* 멀티모달 튜터링 세션 카드 */}
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:border-indigo-500 transition-all duration-300 hover:shadow-indigo-900/20 overflow-hidden group">
            <div className="p-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl mr-4">
                  <span>🎥</span>
                </div>
                <h2 className="text-2xl font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                  멀티모달 튜터링 세션
                </h2>
              </div>

              <p className="text-gray-300 mb-6">
                화상, 화면 공유, 음성을 활용한 고급 튜터링 세션입니다. 더 풍부한 학습 경험과 상호작용을 제공합니다.
              </p>

              <div className="bg-gray-700/50 p-5 rounded-lg mb-6">
                <h3 className="font-semibold text-indigo-300 mb-3">주요 특징:</h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    실시간 화상 튜터링
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    화면 공유로 함께 보기
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    음성 인식을 통한 자연스러운 대화
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    대화 내용 텍스트로 자동 기록
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link 
                  href="/session"
                  className="block w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-center transition-colors"
                >
                  멀티모달 세션 시작하기
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/dashboard"
            className="text-gray-400 hover:text-gray-300 transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            대시보드로 돌아가기
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes loadingBar {
          0% { width: 0; }
          50% { width: 100%; }
          100% { width: 0; }
        }
        
        .animate-loading-bar {
          animation: loadingBar 2s infinite;
        }
      `}</style>
    </div>
  );
} 