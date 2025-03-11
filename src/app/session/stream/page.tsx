'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StreamSessionRedirect() {
  const router = useRouter();
  
  // 자동으로 메인 세션 페이지로 리디렉션
  useEffect(() => {
    // 2초 후에 리디렉션 (메시지 읽을 시간 확보)
    const timer = setTimeout(() => {
      router.replace('/session');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-900 text-gray-200">
      <div className="text-center max-w-xl">
        <h1 className="text-2xl font-bold mb-4">기능 업데이트 안내</h1>
        <p className="text-gray-300 mb-6">
          실시간 스트리밍 세션 기능이 멀티모달 튜터링 세션으로 통합되었습니다.
          곧 메인 세션 페이지로 이동합니다.
        </p>
        <div className="mt-4 animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
} 