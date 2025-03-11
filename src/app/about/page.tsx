import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">RealTutor 소개</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">RealTutor란?</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          RealTutor는 Google AI Studio의 Stream Realtime 기술을 기반으로 한 AI 튜터링 시스템입니다. 
          학습자의 특성과 수준에 맞춘 개인화된 학습 경험을 실시간으로 제공합니다.
        </p>
        <p className="text-gray-700 dark:text-gray-300">
          다양한 학습 주제에 대해 즉각적인 피드백과 맞춤형 가이드를 통해 효율적인 학습을 도와드립니다.
        </p>
      </section>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">주요 기능</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
          <li><strong>개인화된 학습 경험</strong>: 학습자의 수준과 관심사에 맞춘 맞춤형 튜터링</li>
          <li><strong>실시간 피드백</strong>: 즉각적인 응답과 상호작용으로 학습 효율 향상</li>
          <li><strong>멀티모달 입력</strong>: 텍스트, 음성, 이미지 등 다양한 형태의 입력 지원</li>
          <li><strong>코드 하이라이팅</strong>: 프로그래밍 학습을 위한 코드 구문 강조 기능</li>
          <li><strong>학습 분석</strong>: 세션 요약 및 학습 진행 상황 추적</li>
        </ul>
      </section>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">지원하는 학습 영역</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-xl font-medium mb-2">프로그래밍</h3>
            <p className="text-gray-600 dark:text-gray-400">JavaScript, Python, Java 등 다양한 프로그래밍 언어 및 개념 학습</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-xl font-medium mb-2">수학</h3>
            <p className="text-gray-600 dark:text-gray-400">기초 수학부터 고급 수학까지 폭넓은 주제 학습 지원</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-xl font-medium mb-2">과학</h3>
            <p className="text-gray-600 dark:text-gray-400">물리, 화학, 생물학 등 과학 전반에 걸친 개념 학습</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-xl font-medium mb-2">언어</h3>
            <p className="text-gray-600 dark:text-gray-400">다양한 언어의 문법, 어휘, 표현 학습 및 연습</p>
          </div>
        </div>
      </section>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">시작하기</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          RealTutor를 시작하려면 계정을 만들고 대시보드에서 새 학습 세션을 생성하세요.
          학습 주제와 목표를 설정하면 AI 튜터가 맞춤형 학습 경험을 제공합니다.
        </p>
        <div className="flex space-x-4 mt-6">
          <Link 
            href="/signup" 
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            회원가입
          </Link>
          <Link 
            href="/dashboard" 
            className="px-6 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            대시보드 둘러보기
          </Link>
        </div>
      </section>
    </div>
  );
} 