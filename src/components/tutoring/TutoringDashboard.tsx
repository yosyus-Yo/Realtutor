'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VideoChat } from './VideoChat';
import { ScreenShare } from './ScreenShare';
import { AudioControls } from './AudioControls';
import { getMultimodalSessionInfo, clearMultimodalSessionInfo } from '@/lib/utils/localStorage';
import { generateTutorResponse, startTutoringSession } from '@/lib/api/gemini';
import { v4 as uuidv4 } from 'uuid';

// 통합된 오디오 컨트롤 상태 관리를 위한 인터페이스
interface AudioState {
  stream: MediaStream | null;
  active: boolean;
  deviceInfo: string;
  volume: number;
  isSpeaking: boolean;
}

// 채팅 메시지 인터페이스
interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
}

// 음성 인식 결과를 위한 타입 정의
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

export const TutoringDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'video' | 'screen' | 'none'>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 세션 정보 상태
  const [sessionInfo, setSessionInfo] = useState<{
    subject: string;
    level: string;
    goal: string;
  } | null>(null);
  
  // 오디오 상태 관리
  const [audioState, setAudioState] = useState<AudioState>({
    stream: null,
    active: false,
    deviceInfo: '',
    volume: 0,
    isSpeaking: false
  });
  
  // 채팅 메시지 상태 관리
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // 음성 인식 상태 관리
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  
  // 음성 인식 객체 참조
  const recognitionRef = useRef<any>(null);
  
  // 메시지 표시 영역 참조 (자동 스크롤용)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 오디오 시각화를 위한 참조
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationFrame = useRef<number | null>(null);
  
  // 미디어 옵션 팝업 관리
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  
  // 세션 정보 불러오기
  useEffect(() => {
    const info = getMultimodalSessionInfo();
    if (info) {
      setSessionInfo(info);
      
      // 로컬 스토리지에서 세션 정보를 불러왔을 때만 초기 환영 메시지 수정
      const initialMessages: ChatMessage[] = [];
      
      // 시스템 메시지 추가
      initialMessages.push({
        id: '1',
        role: 'system',
        content: `튜터링 세션이 시작되었습니다. 학습 주제: ${info.subject}, 난이도: ${info.level}`,
        timestamp: new Date()
      });
      
      // AI 튜터의 첫 메시지 생성 및 추가
      startTutoringSession(info.subject, info.level, info.goal).then(response => {
        if (response.success && response.text) {
          initialMessages.push({
            id: '2',
            role: 'ai',
            content: response.text,
            timestamp: new Date()
          });
          setMessages(initialMessages);
        } else {
          // 응답 생성 실패 시 기본 메시지 사용
          initialMessages.push({
            id: '2',
            role: 'ai',
            content: `안녕하세요! ${info.subject}에 대해 학습을 시작하겠습니다. 무엇을 도와드릴까요?`,
            timestamp: new Date()
          });
          setMessages(initialMessages);
        }
      }).catch(error => {
        console.error('초기 AI 응답 생성 오류:', error);
        initialMessages.push({
          id: '2',
          role: 'ai',
          content: '안녕하세요! 튜터링 세션에 오신 것을 환영합니다. 마이크를 켜고 질문을 해보세요.',
          timestamp: new Date()
        });
        setMessages(initialMessages);
      });
      
      // 세션 사용 후 로컬 스토리지에서 삭제 (중복 사용 방지)
      clearMultimodalSessionInfo();
    } else {
      // 기본 환영 메시지
      setMessages([{
        id: '1',
        role: 'system',
        content: '튜터링 세션이 시작되었습니다. 마이크를 켜고 질문을 해보세요.',
        timestamp: new Date()
      }]);
    }
  }, []);
  
  const handleError = (message: string) => {
    setErrorMessage(message);
    // 3초 후 에러 메시지 제거
    setTimeout(() => setErrorMessage(null), 3000);
  };
  
  // 메시지 추가 함수
  const addMessage = (role: 'user' | 'ai' | 'system', content: string) => {
    // 빈 메시지나 공백만 있는 메시지는 추가하지 않음
    if (!content.trim()) return;
    
    // 너무 짧은 음성 인식 결과는 무시 (의미 있는 메시지 길이 설정)
    if (role === 'user' && content.trim().length < 2) return;
    
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    
    // 사용자 메시지인 경우 AI 응답 생성
    if (role === 'user') {
      generateAIResponse(content);
    }
  };
  
  // AI 응답 생성 함수
  const generateAIResponse = (userMessage: string) => {
    setIsProcessingMessage(true);
    
    if (sessionInfo) {
      // 로컬 스토리지에서 가져온 세션 정보가 있는 경우, 해당 정보를 활용
      const messageHistory = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'ai' ? 'tutor' as const : 'user' as const,
          content: msg.content
        }));
      
      // Gemini API를 호출하여 AI 응답 생성
      generateTutorResponse(
        sessionInfo.subject,
        sessionInfo.level, 
        messageHistory,
        userMessage
      ).then(response => {
        if (response.success && response.text) {
          addMessage('ai', response.text);
        } else {
          // 오류 시 기본 응답
          addMessage('ai', '죄송합니다. 응답을 생성하는 동안 문제가 발생했습니다. 다시 질문해주시겠어요?');
        }
        setIsProcessingMessage(false);
      }).catch(error => {
        console.error('AI 응답 생성 오류:', error);
        addMessage('ai', '죄송합니다. 기술적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
        setIsProcessingMessage(false);
      });
    } else {
      // 세션 정보가 없는 경우 기본 응답 시뮬레이션
      setTimeout(() => {
        const responses = [
          `네, 말씀하신 내용에 대해 설명해 드리겠습니다. ${userMessage}에 관한 내용은...`,
          `좋은 질문입니다. ${userMessage}에 대해 알려드리자면...`,
          `${userMessage}에 대한 질문을 주셨군요. 다음과 같이 답변 드립니다...`,
          `${userMessage}에 관해 더 자세히 알고 싶으시다면, 추가 질문을 해주세요.`,
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        addMessage('ai', randomResponse);
        setIsProcessingMessage(false);
      }, 1500);
    }
  };
  
  // 오디오 스트림 시작
  const startAudio = async () => {
    try {
      if (!audioState.active) {
        // 오디오 스트림 요청
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false
        });
        
        // 오디오 분석 설정
        if (!audioContext.current) {
          audioContext.current = new AudioContext();
        }
        
        // 오디오 트랙 정보 표시
        const audioTrack = newStream.getAudioTracks()[0];
        let deviceInfo = '';
        if (audioTrack) {
          deviceInfo = `마이크: ${audioTrack.label}`;
        }
        
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 256;
        
        const source = audioContext.current.createMediaStreamSource(newStream);
        source.connect(analyser.current);
        
        const bufferLength = analyser.current.frequencyBinCount;
        dataArray.current = new Uint8Array(bufferLength);
        
        // 시각화 시작
        startVisualization();
        
        // 음성 인식 시작
        startSpeechRecognition(newStream);
        
        setAudioState({
          stream: newStream,
          active: true,
          deviceInfo: deviceInfo,
          volume: 0,
          isSpeaking: false
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("오디오 접근 오류:", error);
      handleError("마이크 접근이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
      return false;
    }
  };
  
  // 오디오 스트림 중지
  const stopAudio = () => {
    if (audioState.stream) {
      audioState.stream.getTracks().forEach(track => track.stop());
    }
    
    stopVisualization();
    stopSpeechRecognition();
    
    setAudioState({
      stream: null,
      active: false,
      deviceInfo: '',
      volume: 0,
      isSpeaking: false
    });
  };
  
  // 음성 인식 시작
  const startSpeechRecognition = (stream: MediaStream) => {
    // 브라우저 호환성 확인
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      handleError("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    
    // 음성 인식 업데이트 제어를 위한 변수 (실시간 표시를 위해 간격 축소)
    let lastInterimResult = '';
    let lastUpdateTime = Date.now();
    const updateInterval = 150; // 임시 결과 업데이트 간격(ms) - 더 짧게 조정
    let interimStabilityCounter = 0;
    const stabilityThreshold = 2; // 안정화 임계값 - 더 낮게 조정
    let minInterimLength = 1; // 최소 임시 결과 길이 - 더 짧게 조정
    
    recognition.onstart = () => {
      setIsListening(true);
      console.log('음성 인식 시작됨');
    };
    
    recognition.onend = () => {
      // 상태가 활성화된 상태라면 다시 시작
      if (audioState.active) {
        recognition.start();
      } else {
        setIsListening(false);
      }
    };
    
    recognition.onresult = (event: any) => {
      const currentTime = Date.now();
      
      // 모든 임시 결과와 최종 결과 수집
      const results = Array.from(event.results) as SpeechRecognitionResult[];
      
      // 최종 결과 처리
      const finalTranscript = results
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(' ');
        
      // 임시 결과 처리 - 모든 임시 결과 통합
      let interimTranscript = '';
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result.isFinal) {
          interimTranscript += result[0].transcript + ' ';
        }
      }
      interimTranscript = interimTranscript.trim();
      
      // 최종 결과가 있으면 처리
      if (finalTranscript && finalTranscript.trim().length >= 2) {
        setTranscript(''); // 임시 결과 초기화
        addMessage('user', finalTranscript.trim());
        lastInterimResult = ''; // 임시 결과 캐시 초기화
        interimStabilityCounter = 0;
        return; // 최종 결과가 있으면 임시 결과 처리 스킵
      }
      
      // 임시 결과 업데이트 - 실시간 표시를 위한 개선
      if (interimTranscript) {
        // 너무 짧은 임시 결과여도 표시 (실시간 느낌을 위해)
        if (interimTranscript.trim().length < minInterimLength) {
          if (interimTranscript.trim().length === 0 && transcript) {
            setTranscript('');
          }
          return;
        }
        
        // 새로운 결과가 이전과 다르면 바로 업데이트
        if (interimTranscript !== lastInterimResult) {
          interimStabilityCounter = 0;
          lastInterimResult = interimTranscript;
          setTranscript(interimTranscript);
          lastUpdateTime = currentTime;
        } else {
          // 입력이 같으면 안정화 카운터 증가 (안정화 상태일 때는 업데이트 줄임)
          interimStabilityCounter++;
          
          // 안정화된 상태에서는 업데이트 간격을 늘림
          if (interimStabilityCounter < stabilityThreshold || 
              currentTime - lastUpdateTime > updateInterval * 2) {
            setTranscript(interimTranscript);
            lastUpdateTime = currentTime;
          }
        }
      } else if (transcript) {
        // 임시 결과가 없으면 초기화
        setTranscript('');
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('음성 인식 오류:', event.error);
      if (event.error === 'no-speech') {
        // no-speech는 일반적인 오류이므로 무시
        return;
      }
      handleError(`음성 인식 오류: ${event.error}`);
    };
    
    // 인식 시작
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      console.error('음성 인식 시작 오류:', error);
      handleError('음성 인식을 시작할 수 없습니다.');
    }
  };
  
  // 음성 인식 중지
  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('음성 인식 중지 오류:', error);
      }
    }
    setIsListening(false);
    setTranscript('');
  };
  
  // 오디오 레벨 시각화
  const startVisualization = () => {
    const updateVolume = () => {
      if (analyser.current && dataArray.current) {
        analyser.current.getByteFrequencyData(dataArray.current);
        
        // 평균 음량 계산
        let sum = 0;
        for (let i = 0; i < dataArray.current.length; i++) {
          sum += dataArray.current[i];
        }
        const avg = sum / dataArray.current.length;
        
        // 상태 업데이트
        setAudioState(prev => ({
          ...prev,
          volume: avg,
          isSpeaking: avg > 30 // 임계값 조정 가능
        }));
      }
      
      animationFrame.current = requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
  };
  
  const stopVisualization = () => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  };
  
  // 탭 변경 시 오디오 상태 유지
  const handleTabChange = (tab: 'video' | 'screen' | 'none') => {
    setActiveTab(tab);
  };
  
  // 두 미디어 타입 간의 전환 처리 (하나가 활성화되면 다른 하나는 비활성화)
  const toggleMedia = (mediaType: 'video' | 'screen') => {
    // 이미 활성화된 미디어 타입이면 비활성화
    if (activeTab === mediaType) {
      setActiveTab('none'); // 둘 다 비활성화 상태로 설정
    } else {
      // 다른 미디어 타입이 활성화 중이면 그것을 비활성화하고 선택한 것을 활성화
      setActiveTab(mediaType);
    }
  };
  
  // VideoChat과 ScreenShare 컴포넌트에 전달할 속성을 계산하는 함수들
  const isScreenActive = () => activeTab === 'screen';
  const isVideoActive = () => activeTab === 'video';

  // VideoChat의 onStopScreenShare 핸들러
  const handleStopScreenShare = () => {
    if (isScreenActive()) {
      toggleMedia('screen');
    }
  };

  // ScreenShare의 onStopCamera 핸들러
  const handleStopCamera = () => {
    if (isVideoActive()) {
      toggleMedia('video');
    }
  };
  
  // 새 메시지가 추가될 때 스크롤 처리
  useEffect(() => {
    // 초기 로드 시 스크롤하지 않도록 설정
    if (messagesEndRef.current && messages.length > 1) {
      // 마지막으로 추가된 메시지가 사용자 또는 AI의 메시지인 경우에만 스크롤
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && (lastMessage.role === 'user' || lastMessage.role === 'ai')) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);
  
  // 컴포넌트 마운트 해제 시 리소스 정리
  useEffect(() => {
    return () => {
      stopAudio();
      
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close();
      }
    };
  }, []);
  
  // 메시지 시간 포맷팅 함수
  const formatMessageTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="tutoring-dashboard bg-gray-900 text-gray-200 h-screen flex flex-col">
      {/* 상단 헤더 영역 */}
      <div className="dashboard-header p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-blue-300">멀티모달 튜터링 세션</h2>
          {audioState.active && (
            <div className="audio-indicator flex items-center bg-green-900/30 text-green-300 px-2 py-1 rounded border border-green-700 text-xs">
              <div 
                className={`w-2 h-2 rounded-full mr-1 ${audioState.isSpeaking ? 'bg-green-400 pulse-animation' : 'bg-green-600'}`}
              ></div>
              <span>마이크 활성화됨</span>
            </div>
          )}
        </div>
        
        {sessionInfo && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="px-2 py-1 bg-blue-900/40 rounded-full border border-blue-800/30">
                <span className="text-blue-300 font-semibold">주제:</span> {sessionInfo.subject}
              </span>
              <span className="px-2 py-1 bg-blue-900/40 rounded-full border border-blue-800/30">
                <span className="text-blue-300 font-semibold">난이도:</span> {
                  sessionInfo.level === 'beginner' ? '초급' : 
                  sessionInfo.level === 'intermediate' ? '중급' : '고급'
                }
              </span>
            </div>
          </div>
        )}
      </div>
      
      {errorMessage && (
        <div className="error-banner bg-red-900/30 text-red-300 border border-red-800/50 m-2">
          {errorMessage}
        </div>
      )}
      
      {/* 메인 채팅 영역 */}
      <div className="flex-grow flex flex-col overflow-hidden p-4">
        {/* 메시지 표시 영역 */}
        <div className="flex-grow overflow-y-auto messages-container bg-gray-800/50 rounded-lg mb-4 p-4 border border-gray-700">
          {messages.map(message => (
            <div 
              key={message.id} 
              className={`message mb-3 ${message.role === 'user' ? 'user-message' : message.role === 'ai' ? 'ai-message' : 'system-message'}`}
            >
              <div className={`message-bubble p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-800 text-blue-100 ml-auto' 
                  : message.role === 'ai'
                    ? 'bg-green-800 text-green-100' 
                    : 'bg-gray-800 text-center text-sm text-gray-300'
              }`}>
                {message.content}
                <div className="text-xs mt-1 text-gray-400">
                  {formatMessageTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {/* 음성 인식 중인 내용 표시 */}
          {transcript && (
            <div className="message user-message mb-3">
              <div className="message-bubble realtime-speech p-3 rounded-lg ml-auto text-blue-200">
                <div className="flex items-end">
                  <div>
                    {transcript}
                    <span className="typing-cursor"></span>
                  </div>
                  <div className="voice-wave ml-2 flex items-end">
                    <span className="voice-bar"></span>
                    <span className="voice-bar"></span>
                    <span className="voice-bar"></span>
                    <span className="voice-bar"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* AI 응답 처리 중 표시 */}
          {isProcessingMessage && (
            <div className="message ai-message mb-3">
              <div className="message-bubble bg-green-900/50 p-3 rounded-lg opacity-80 text-green-200">
                <div className="flex items-center">
                  <span className="mr-2">AI가 응답 중입니다</span>
                  <div className="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 자동 스크롤을 위한 참조 지점 */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* 입력 영역 - Google AI Studio 스타일 */}
        <div className="input-area bg-gray-800 rounded-lg border border-gray-700 flex items-stretch">
          {/* 미디어 컨트롤 버튼 (입력창 왼쪽) */}
          <div className="media-toggle relative">
            <button 
              className="h-full flex items-center justify-center px-4 text-gray-300 hover:text-blue-300 border-r border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors"
              onClick={() => {
                // 미디어 선택 팝업 토글
                setShowMediaOptions(!showMediaOptions);
              }}
            >
              {activeTab === 'video' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : activeTab === 'screen' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            
            {/* 미디어 옵션 팝업 */}
            {showMediaOptions && (
              <div className="absolute bottom-full left-0 mb-2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 w-48 overflow-hidden">
                <button 
                  className={`w-full text-left px-4 py-3 flex items-center ${activeTab === 'video' ? 'bg-blue-900/50 text-blue-300' : 'hover:bg-gray-700 text-gray-300'}`}
                  onClick={() => {
                    toggleMedia('video');
                    setShowMediaOptions(false);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {activeTab === 'video' ? '카메라 끄기' : '카메라 켜기'}
                </button>
                <button 
                  className={`w-full text-left px-4 py-3 flex items-center ${activeTab === 'screen' ? 'bg-blue-900/50 text-blue-300' : 'hover:bg-gray-700 text-gray-300'}`}
                  onClick={() => {
                    toggleMedia('screen');
                    setShowMediaOptions(false);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {activeTab === 'screen' ? '화면 공유 중지' : '화면 공유 시작'}
                </button>
                <button 
                  className={`w-full text-left px-4 py-3 flex items-center ${activeTab === 'none' ? 'bg-blue-900/50 text-blue-300' : 'hover:bg-gray-700 text-gray-300'}`}
                  onClick={() => {
                    setActiveTab('none');
                    setShowMediaOptions(false);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  미디어 비활성화
                </button>
              </div>
            )}
          </div>
          
          {/* 마이크 활성화 상태에 따른 입력 영역 */}
          {audioState.active ? (
            <div className="flex-grow p-3 flex items-center justify-between">
              <div className="flex items-center text-sm">
                <div className={`w-3 h-3 rounded-full mr-2 ${isListening ? 'bg-green-400 pulse-animation' : 'bg-gray-500'}`}></div>
                <span className="text-gray-300">
                  {isListening ? (
                    audioState.isSpeaking ? '듣고 있습니다...' : '말씀해주세요...'
                  ) : '음성 인식 준비 중...'}
                </span>
              </div>
              <button
                onClick={stopAudio}
                className="text-sm text-red-400 hover:text-red-300 px-3 py-1 bg-red-900/30 rounded border border-red-800/30"
              >
                마이크 중지
              </button>
            </div>
          ) : (
            <button
              onClick={startAudio}
              className="flex-grow p-3 bg-gray-800 hover:bg-gray-700 text-blue-300 transition-colors"
            >
              마이크를 활성화하여 대화 시작하기
            </button>
          )}
        </div>
      </div>
      
      {/* 미디어 표시 영역 - 사이드 패널로 표시, 활성화된 경우에만 표시 */}
      {(activeTab === 'video' || activeTab === 'screen') && (
        <div className="fixed top-20 right-4 w-64 md:w-80 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden z-10">
          <div className="p-2 bg-gray-900 flex justify-between items-center">
            <span className="text-sm font-medium text-blue-300">
              {activeTab === 'video' ? '카메라' : '화면 공유'}
            </span>
            <button 
              className="text-gray-400 hover:text-gray-300"
              onClick={() => setActiveTab('none')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="h-48 md:h-56 bg-gray-900">
            {activeTab === 'video' && (
              <VideoChat 
                isActive={activeTab === 'video'} 
                onError={handleError}
                audioRequired={true}
                onAudioNeeded={startAudio}
                audioState={audioState}
                screenSharingActive={isScreenActive()}
                onStopScreenShare={handleStopScreenShare}
              />
            )}
            
            {activeTab === 'screen' && (
              <ScreenShare 
                isActive={activeTab === 'screen'} 
                onError={handleError}
                audioRequired={true}
                onAudioNeeded={startAudio}
                audioState={audioState}
                cameraActive={isVideoActive()}
                onStopCamera={handleStopCamera}
              />
            )}
          </div>
        </div>
      )}
      
      <style jsx>{`
        .messages-container {
          scrollbar-width: thin;
          scrollbar-color: #4b5563 #1f2937;
        }
        
        .messages-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .messages-container::-webkit-scrollbar-track {
          background: #1f2937;
        }
        
        .messages-container::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 20px;
        }
        
        .message {
          display: flex;
          max-width: 100%;
        }
        
        .message-bubble {
          max-width: 85%;
          word-break: break-word;
        }
        
        .user-message {
          justify-content: flex-end;
        }
        
        .ai-message {
          justify-content: flex-start;
        }
        
        .system-message {
          justify-content: center;
        }
        
        .pulse-animation {
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        /* 실시간 음성 입력을 위한 스타일 */
        .realtime-speech {
          background-color: rgba(30, 64, 175, 0.5);
          border: 1px solid rgba(37, 99, 235, 0.4);
          box-shadow: 0 0 10px rgba(37, 99, 235, 0.2);
          transition: all 0.2s ease;
        }
        
        .typing-cursor {
          display: inline-block;
          width: 2px;
          height: 16px;
          background-color: #93c5fd;
          margin-left: 4px;
          animation: blink 0.7s infinite;
          vertical-align: middle;
        }
        
        .voice-wave {
          height: 14px;
        }
        
        .voice-bar {
          display: inline-block;
          width: 3px;
          background-color: #3b82f6;
          margin: 0 1px;
          border-radius: 1px;
          animation: voiceWave 0.5s infinite ease-in-out;
        }
        
        .voice-bar:nth-child(1) {
          height: 6px;
          animation-delay: 0s;
        }
        
        .voice-bar:nth-child(2) {
          height: 10px;
          animation-delay: 0.2s;
        }
        
        .voice-bar:nth-child(3) {
          height: 14px;
          animation-delay: 0.1s;
        }
        
        .voice-bar:nth-child(4) {
          height: 8px;
          animation-delay: 0.3s;
        }
        
        @keyframes voiceWave {
          0%, 100% {
            transform: scaleY(0.5);
          }
          50% {
            transform: scaleY(1.2);
          }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}; 