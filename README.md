# RealTutor - AI 기반 실시간 튜터링 시스템

Google AI Studio의 Stream Realtime 기술을 기반으로 한 개인화된 실시간 AI 튜터링 시스템입니다. 맞춤형 학습 경험을 통해 사용자의 교육 효과를 극대화합니다.

## 주요 기능

- **실시간 AI 튜터링**: Gemini 1.5 Pro/Flash 모델을 활용한 고품질 실시간 튜터링
- **개인화된 학습 경로**: 사용자 수준에 맞춘 적응형 학습 경험 제공
- **멀티모달 상호작용**: 텍스트, 음성, 이미지 등 다양한 형태의 입력 처리
- **학습 분석 및 피드백**: 학습 성과 추적 및 맞춤형 피드백 제공

## 시작하기

### 요구사항

- Node.js 18.0.0 이상
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/yourusername/realtutor.git
cd realtutor

# 의존성 설치
npm install
# 또는
yarn install
```

### 개발 서버 실행

```bash
npm run dev
# 또는
yarn dev
```

이후 브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하세요.

## 프로젝트 구조

```
realtutor/
├── src/
│   ├── app/                 # Next.js 애플리케이션 페이지
│   │   ├── dashboard/       # 학습 대시보드
│   │   ├── session/         # 학습 세션 관련 페이지
│   │   └── profile/         # 사용자 프로필 관리
│   ├── components/          # 재사용 가능한 컴포넌트
│   │   ├── common/          # 공통 UI 컴포넌트
│   │   └── tutoring/        # 튜터링 관련 컴포넌트
│   ├── lib/                 # 유틸리티 및 헬퍼 함수
│   │   ├── api/             # API 호출 관련 함수
│   │   ├── hooks/           # 커스텀 React 훅
│   │   └── utils/           # 유틸리티 함수
│   ├── styles/              # 글로벌 스타일 및 테마
│   └── types/               # TypeScript 타입 정의
├── public/                  # 정적 파일
└── ...
```

## 기술 스택

- **Frontend**: React 18, Next.js 14, Tailwind CSS
- **Backend**: Firebase, Node.js (예정)
- **AI/ML**: Gemini 1.5 Pro/Flash
- **데이터베이스**: Firebase Firestore (예정)

## 구현 로드맵

1. **Phase 1 (현재)**
   - 기본 UI/UX 구현
   - 인증 및 사용자 관리
   - 기본 세션 관리

2. **Phase 2**
   - Gemini API 통합
   - 실시간 튜터링 기능
   - 기본 학습 분석

3. **Phase 3**
   - 고급 멀티모달 기능
   - 확장된 학습 도메인
   - 고급 학습 분석 및 추천

## 라이선스

MIT

---

© 2025 RealTutor
