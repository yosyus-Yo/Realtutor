'use client';

import { useState, useEffect, useRef } from 'react';
import { isSpeechRecognitionSupported, SpeechRecognizer } from '@/lib/utils/speech';

interface SpeechRecognitionButtonProps {
  onResult: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function SpeechRecognitionButton({
  onResult,
  onStart,
  onEnd
}: SpeechRecognitionButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const recognizerRef = useRef<SpeechRecognizer | null>(null);

  // 컴포넌트 마운트 시 브라우저 지원 여부 확인
  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== 'undefined') {
      setIsSupported(isSpeechRecognitionSupported());
      
      // 인식기 인스턴스 생성
      if (isSpeechRecognitionSupported()) {
        try {
          recognizerRef.current = new SpeechRecognizer();
        } catch (error) {
          console.error('음성 인식 초기화 오류:', error);
          setIsSupported(false);
        }
      }
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);
  
  // 음성 인식 토글
  const toggleListening = () => {
    if (!recognizerRef.current || !isSupported) return;
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  // 음성 인식 시작
  const startListening = () => {
    if (!recognizerRef.current) return;
    
    setTranscript('');
    setIsListening(true);
    
    recognizerRef.current.start({
      onStart: () => {
        console.log('음성 인식 시작');
        if (onStart) onStart();
      },
      onResult: (result) => {
        setTranscript(result.transcript);
        
        // 문장이 완료된 경우 결과 전달
        if (result.isFinal) {
          onResult(result.transcript);
          // 계속 듣기를 원하면 아래 줄 주석 처리
          // stopListening();
        }
      },
      onEnd: () => {
        console.log('음성 인식 종료');
        setIsListening(false);
        if (onEnd) onEnd();
      },
      onError: (error) => {
        console.error('음성 인식 오류:', error);
        setIsListening(false);
        if (onEnd) onEnd();
      }
    });
  };
  
  // 음성 인식 중지
  const stopListening = () => {
    if (!recognizerRef.current) return;
    
    recognizerRef.current.stop();
    setIsListening(false);
    
    // 마지막 결과가 있다면 전달
    if (transcript.trim()) {
      onResult(transcript);
    }
  };
  
  // 지원되지 않는 브라우저인 경우
  if (!isSupported) {
    return (
      <button
        className="p-2 text-gray-400 cursor-not-allowed opacity-50"
        disabled={true}
        title="이 브라우저는 음성 인식을 지원하지 않습니다"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    );
  }
  
  return (
    <div className="relative">
      <button
        className={`p-2 text-gray-600 dark:text-gray-300 ${
          isListening
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 animate-pulse'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        } rounded-full transition-colors`}
        onClick={toggleListening}
        title={isListening ? '음성 인식 중지' : '음성 인식 시작'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      
      {isListening && transcript && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md text-sm">
          {transcript}
        </div>
      )}
    </div>
  );
} 