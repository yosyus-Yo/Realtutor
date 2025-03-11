'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resetPassword } from '@/lib/api/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const result = await resetPassword(email);
      
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || '비밀번호 재설정 이메일 전송에 실패했습니다.');
      }
    } catch (error: any) {
      setError(error.message || '비밀번호 재설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">비밀번호 찾기</h1>
          <p className="text-gray-600 dark:text-gray-300">
            계정에 등록된 이메일 주소를 입력하세요
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md">
                비밀번호 재설정 이메일이 전송되었습니다. 이메일을 확인해주세요.
              </div>
              <Link
                href="/login"
                className="block w-full py-2 px-4 text-center bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                로그인 페이지로 돌아가기
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
                  placeholder="이메일 주소"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '처리 중...' : '재설정 이메일 전송'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-600 dark:text-gray-300">
            <Link href="/login" className="text-blue-600 hover:underline">
              로그인으로 돌아가기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 