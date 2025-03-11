'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';

type AvatarSize = 'sm' | 'md' | 'lg';

interface ProfileAvatarProps {
  size?: AvatarSize;
  showMenu?: boolean;
  className?: string;
}

export default function ProfileAvatar({ 
  size = 'md', 
  showMenu = true,
  className = '' 
}: ProfileAvatarProps) {
  const { user, profile, loading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };
  
  const avatarSize = sizeMap[size];
  
  // 로딩 중이거나 로그인되지 않은 경우
  if (loading) {
    return (
      <div className={`${avatarSize} rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />
    );
  }
  
  if (!user) {
    return (
      <Link 
        href="/login"
        className={`${avatarSize} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors ${className}`}
        aria-label="로그인"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width={size === 'lg' ? 24 : size === 'md' ? 20 : 16} height={size === 'lg' ? 24 : size === 'md' ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </Link>
    );
  }
  
  // 아바타 이미지 또는 이니셜 생성
  const avatarContent = user.photoURL ? (
    <Image 
      src={user.photoURL} 
      alt={`${user.displayName || '사용자'} 프로필 이미지`} 
      width={size === 'lg' ? 48 : size === 'md' ? 40 : 32} 
      height={size === 'lg' ? 48 : size === 'md' ? 40 : 32}
      className="rounded-full object-cover"
    />
  ) : (
    <div className="text-white font-medium">
      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
    </div>
  );
  
  // 메뉴가 필요 없는 경우 (아바타만 표시)
  if (!showMenu) {
    return (
      <div 
        className={`${avatarSize} rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white ${className}`}
        aria-label={user.displayName || '사용자 프로필'}
      >
        {avatarContent}
      </div>
    );
  }
  
  // 메뉴가 있는 아바타
  return (
    <div className="relative">
      <button
        className={`${avatarSize} rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200 ${className}`}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="프로필 메뉴 열기"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        {avatarContent}
      </button>
      
      {isMenuOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700 animate-fade-in-down"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu"
        >
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {user.displayName || '사용자'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </p>
          </div>
          
          <Link 
            href="/profile"
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            role="menuitem"
            onClick={() => setIsMenuOpen(false)}
          >
            내 프로필
          </Link>
          
          <Link 
            href="/dashboard"
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            role="menuitem"
            onClick={() => setIsMenuOpen(false)}
          >
            대시보드
          </Link>
          
          <button
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            role="menuitem"
            onClick={() => {
              logout();
              setIsMenuOpen(false);
            }}
          >
            로그아웃
          </button>
        </div>
      )}
      
      <style jsx>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-down {
          animation: fadeInDown 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
} 