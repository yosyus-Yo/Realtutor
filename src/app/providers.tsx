'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { useEffect } from 'react';
import { setupOfflineSyncListener } from '@/lib/offline/syncManager';

export function Providers({ children }: { children: ReactNode }) {
  // 오프라인 동기화 리스너 설정
  useEffect(() => {
    // 브라우저 환경에서만 실행
    if (typeof window !== 'undefined') {
      const cleanup = setupOfflineSyncListener();
      // 이벤트 리스너 해제
      return cleanup;
    }
  }, []);

  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
} 