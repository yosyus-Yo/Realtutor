'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MediaStreamPageRedirect() {
  const router = useRouter();
  
  // 자동으로 메인 세션 페이지로 리디렉션
  useEffect(() => {
    router.replace('/session');
  }, [router]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">리디렉션 중...</h1>
        <p className="text-gray-600">
          실시간 스트리밍 세션이 업데이트되었습니다. 새로운 세션 페이지로 이동합니다.
        </p>
        <div className="mt-4 animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
} 