'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  // 마운트 후 애니메이션 적용
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
      <div className={`text-center transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
          RealTutor
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 transition-transform delay-200 duration-500 transform translate-y-0 opacity-100">
          AI 기반 실시간 튜터링 시스템
        </p>
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-600 dark:text-gray-300 mb-8 transition-transform delay-400 duration-500 transform translate-y-0 opacity-100">
            Google AI Studio의 Stream Realtime 기술을 활용한 개인화된 학습 경험을 제공합니다.
            실시간으로 피드백을 받고, 자신만의 학습 경로를 따라가세요.
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}>
        <FeatureCard 
          title="개인화된 학습" 
          description="학습자의 특성과 수준에 맞춘 맞춤형 튜터링을 제공합니다."
          icon="👤"
          delay={100}
        />
        <FeatureCard 
          title="실시간 피드백" 
          description="즉각적인 피드백으로 학습 효율을 극대화합니다."
          icon="⚡"
          delay={200}
        />
        <FeatureCard 
          title="멀티모달 상호작용" 
          description="텍스트, 음성, 이미지 등 다양한 형태의 상호작용을 지원합니다."
          icon="🔄"
          delay={300}
        />
      </div>

      <div className={`flex gap-4 mt-8 transition-all duration-700 delay-700 ${mounted ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-10'}`}>
        <Link 
          href="/dashboard" 
          className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="대시보드로 이동하여 학습 시작하기"
        >
          시작하기
        </Link>
        <Link 
          href="/about" 
          className="px-6 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="RealTutor에 대해 더 알아보기"
        >
          더 알아보기
        </Link>
      </div>
      
      <style jsx>{`
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
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 5s ease infinite;
        }
      `}</style>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  delay?: number;
}

function FeatureCard({ title, description, icon, delay = 0 }: FeatureCardProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay]);
  
  return (
    <div 
      className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform ${
        mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'
      } hover:scale-105`}
    >
      <div className="text-4xl mb-4 transform transition-transform hover:scale-110 hover:rotate-12">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}
