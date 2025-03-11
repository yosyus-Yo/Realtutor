'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TutoringDashboard } from '@/components/tutoring/TutoringDashboard';

export default function SessionPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // 로딩 중이 아니고 사용자가 로그인되지 않은 경우 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  // 페이지 로드 시 스크롤 위치 초기화
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
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
    <div className="flex flex-col items-center p-6 bg-gradient-to-b from-gray-900 to-gray-800 text-gray-200">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              멀티모달 튜터링 세션
            </h1>
            <p className="text-gray-400 mt-2">
              화상, 화면 공유 및 음성을 통해 AI 튜터와 실시간으로 소통하세요.
            </p>
          </div>
          <Link 
            href="/dashboard"
            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            대시보드로 돌아가기
          </Link>
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <TutoringDashboard />
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
        
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
} 