'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function Profile() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [level, setLevel] = useState('beginner');
  const [interactionMode, setInteractionMode] = useState('text');
  const [interests, setInterests] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 인증되지 않은 사용자를 로그인 페이지로 리디렉션
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 프로필 정보로 폼 초기화
  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
      setLevel(profile.learningPreferences?.level || 'beginner');
      setInteractionMode(profile.learningPreferences?.preferredInteractionMode || 'text');
      setInterests(profile.learningPreferences?.interests || []);
    }
  }, [profile]);

  const handleInterestsChange = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(item => item !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: name,
        learningPreferences: {
          level,
          preferredInteractionMode: interactionMode,
          interests
        }
      });
      
      setMessage({ 
        type: 'success', 
        text: '프로필이 성공적으로 업데이트되었습니다.' 
      });
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: `프로필 업데이트 중 오류가 발생했습니다: ${error.message}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // 로딩 중이거나 인증되지 않은 경우 로딩 표시
  if (loading || !user) {
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">내 프로필</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          로그아웃
        </button>
      </div>

      {message.text && (
        <div className={`mb-6 p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              이메일
            </label>
            <input
              type="email"
              id="email"
              value={user.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            />
            <p className="mt-1 text-sm text-gray-500">이메일은 변경할 수 없습니다.</p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              이름
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              학습 수준
            </label>
            <div className="flex flex-wrap gap-3">
              <LevelRadio
                id="beginner"
                label="초급"
                checked={level === 'beginner'}
                onChange={() => setLevel('beginner')}
              />
              <LevelRadio
                id="intermediate"
                label="중급"
                checked={level === 'intermediate'}
                onChange={() => setLevel('intermediate')}
              />
              <LevelRadio
                id="advanced"
                label="고급"
                checked={level === 'advanced'}
                onChange={() => setLevel('advanced')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              선호하는 상호작용 모드
            </label>
            <div className="flex flex-wrap gap-3">
              <ModeRadio
                id="text"
                label="텍스트"
                icon="💬"
                checked={interactionMode === 'text'}
                onChange={() => setInteractionMode('text')}
              />
              <ModeRadio
                id="voice"
                label="음성"
                icon="🎤"
                checked={interactionMode === 'voice'}
                onChange={() => setInteractionMode('voice')}
              />
              <ModeRadio
                id="visual"
                label="이미지/화면"
                icon="📷"
                checked={interactionMode === 'visual'}
                onChange={() => setInteractionMode('visual')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              관심 학습 영역
            </label>
            <div className="flex flex-wrap gap-3">
              <InterestCheckbox
                id="math"
                label="수학"
                checked={interests.includes('math')}
                onChange={() => handleInterestsChange('math')}
              />
              <InterestCheckbox
                id="programming"
                label="프로그래밍"
                checked={interests.includes('programming')}
                onChange={() => handleInterestsChange('programming')}
              />
              <InterestCheckbox
                id="science"
                label="과학"
                checked={interests.includes('science')}
                onChange={() => handleInterestsChange('science')}
              />
              <InterestCheckbox
                id="language"
                label="언어"
                checked={interests.includes('language')}
                onChange={() => handleInterestsChange('language')}
              />
              <InterestCheckbox
                id="history"
                label="역사"
                checked={interests.includes('history')}
                onChange={() => handleInterestsChange('history')}
              />
              <InterestCheckbox
                id="arts"
                label="예술"
                checked={interests.includes('arts')}
                onChange={() => handleInterestsChange('arts')}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '변경사항 저장'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LevelRadio({ id, label, checked, onChange }: { 
  id: string; 
  label: string; 
  checked: boolean; 
  onChange: () => void;
}) {
  return (
    <label className={`flex items-center px-4 py-2 rounded-lg cursor-pointer border-2 ${
      checked 
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}>
      <input
        type="radio"
        id={id}
        name="level"
        className="hidden"
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

function ModeRadio({ id, label, icon, checked, onChange }: { 
  id: string; 
  label: string; 
  icon: string;
  checked: boolean; 
  onChange: () => void;
}) {
  return (
    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border-2 ${
      checked 
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}>
      <input
        type="radio"
        id={id}
        name="interactionMode"
        className="hidden"
        checked={checked}
        onChange={onChange}
      />
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </label>
  );
}

function InterestCheckbox({ id, label, checked, onChange }: { 
  id: string; 
  label: string; 
  checked: boolean; 
  onChange: () => void;
}) {
  return (
    <label className={`flex items-center px-4 py-2 rounded-lg cursor-pointer border-2 ${
      checked 
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}>
      <input
        type="checkbox"
        id={id}
        className="hidden"
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
} 