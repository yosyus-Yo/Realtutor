/**
 * RealTutor 미디어 스트림 튜터 API
 * Google AI Studio의 Stream Realtime 기능을 활용한 화면 공유 및 음성 대화를 지원하는 튜터링 API
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from '@google/generative-ai';
import { recordLearningActivity, LearningActivityType } from './analytics';
import { updateSession } from './sessions';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Browser 타입 확장
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    ImageCapture: any;
  }
}

// API 키는 환경 변수로 관리
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// 환경 변수가 없는 경우 경고
if (!API_KEY) {
  console.warn('NEXT_PUBLIC_GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
}

// Gemini API 인스턴스 생성
const genAI = new GoogleGenerativeAI(API_KEY || '');

// 안전 설정
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// 튜터링 시스템 프롬프트
const TUTOR_SYSTEM_PROMPT = `당신은 RealTutor라는 개인화된 AI 학습 튜터입니다. 
화면 공유와 음성 대화를 통해 학생들을 지도합니다.
화면에 보이는 내용과 학생의 말을 분석하여 실시간으로 도움을 제공하세요.

다음 원칙을 따라주세요:
1. 화면의 코드, 텍스트, 이미지 등을 분석하여 맥락을 파악하세요.
2. 오류를 발견하면 구체적인 해결책을 제시하세요.
3. 설명은 간결하고 명확하게 전달하세요 (음성 대화에 적합하게).
4. 학생이 문제를 스스로 해결할 수 있도록 힌트를 제공하세요.
5. 학생의 이해도를 지속적으로 확인하세요.
6. 학생이 성취했을 때 긍정적인 피드백을 제공하세요.

화면 공유에서는:
- 코드의 구문 오류, 로직 오류, 스타일 문제를 식별하세요.
- 문서나 슬라이드의 주요 내용과 개념을 요약하세요.
- 수학 문제나 다이어그램의 해석을 도와주세요.

음성 대화에서는:
- 학생의 질문을 정확히 이해하고 답변하세요.
- 발음이 명확하지 않은 경우, 가장 가능성 높은 해석을 제시하세요.
- 친절하고 격려하는 톤을 유지하세요.

한국어로 응답해주세요.`;

// 메시지 히스토리를 Gemini API 형식으로 변환
const convertToGeminiHistory = (messageHistory: { role: 'user' | 'model' | 'tutor' | 'system'; content: string }[]): Content[] => {
  return messageHistory.map(msg => ({
    role: msg.role === 'tutor' ? 'model' : (msg.role === 'system' ? 'user' : msg.role),
    parts: [{ text: msg.content }]
  }));
};

/**
 * WebRTC 연결 설정에 필요한 인터페이스
 */
interface RTCConfiguration {
  iceServers: RTCIceServer[];
}

/**
 * 미디어 스트림 설정에 필요한 인터페이스
 */
export interface MediaStreamConfig {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

/**
 * 미디어 스트림 세션 상태
 */
export interface MediaStreamSessionState {
  isConnected: boolean;
  isAudioActive: boolean;
  isVideoActive: boolean;
  isScreenActive: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
}

/**
 * 미디어 스트림 세션 핸들러
 */
export interface MediaStreamSessionHandlers {
  onStateChange?: (state: MediaStreamSessionState) => void;
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
}

/**
 * 미디어 스트림 튜터 세션 클래스
 */
export class MediaStreamTutorSession {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localAudioStream: MediaStream | null = null;
  private localVideoStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private speechRecognition: any = null;
  private speechSynthesis: SpeechSynthesisUtterance | null = null;
  
  private state: MediaStreamSessionState = {
    isConnected: false,
    isAudioActive: false,
    isVideoActive: false,
    isScreenActive: false,
    isProcessing: false,
    isSpeaking: false
  };
  
  private messageHistory: { role: 'user' | 'model' | 'tutor' | 'system'; content: string }[] = [];
  private sessionId: string = '';
  private userId: string = '';
  private subject: string = '';
  private level: string = '';
  private handlers: MediaStreamSessionHandlers = {};
  private capturePeriod: number = 5000; // 화면 캡처 주기 (ms)
  private captureInterval: NodeJS.Timeout | null = null;
  private speechToTextResult: string = '';
  
  /**
   * 미디어 스트림 튜터 세션 생성자
   */
  constructor(
    sessionId: string,
    userId: string,
    subject: string,
    level: string,
    handlers: MediaStreamSessionHandlers = {}
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.subject = subject;
    this.level = level;
    this.handlers = handlers;
    
    // 시스템 메시지 추가
    this.messageHistory.push({
      role: 'system',
      content: `${TUTOR_SYSTEM_PROMPT}\n\n학습 주제: ${subject}\n학습자 수준: ${level}`
    });
    
    // 브라우저에서 실행 중인지 확인
    if (typeof window !== 'undefined') {
      // 음성 인식 API가 있는지 확인
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'ko-KR';
        
        this.setupSpeechRecognition();
      }
      
      // 음성 합성 설정
      this.speechSynthesis = new SpeechSynthesisUtterance();
      this.speechSynthesis.lang = 'ko-KR';
      this.speechSynthesis.rate = 1.0;
      this.speechSynthesis.pitch = 1.0;
    }
    
    // 학습 활동 기록
    this.recordActivity('session_start');
  }
  
  /**
   * 세션 초기화 및 연결 설정
   */
  public async initialize(): Promise<boolean> {
    try {
      const config: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      
      this.peerConnection = new RTCPeerConnection(config);
      
      // 데이터 채널 설정
      this.dataChannel = this.peerConnection.createDataChannel('tutor-session', {
        ordered: true // 순서대로 메시지 전달
      });
      this.setupDataChannel();
      
      // ICE 후보 이벤트 처리
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE 후보:', event.candidate);
        }
      };
      
      // 연결 상태 변경 감지
      this.peerConnection.onconnectionstatechange = () => {
        console.log('연결 상태 변경:', this.peerConnection?.connectionState);
        
        if (this.peerConnection?.connectionState === 'connected') {
          this.updateState({ isConnected: true });
        } else if (this.peerConnection?.connectionState === 'disconnected' || 
                  this.peerConnection?.connectionState === 'failed' || 
                  this.peerConnection?.connectionState === 'closed') {
          this.updateState({ isConnected: false });
        }
      };
      
      // 원격 스트림 처리
      this.peerConnection.ontrack = (event) => {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream?.addTrack(track);
        });
        
        console.log('원격 트랙 추가됨:', event.track.kind);
      };
      
      // 연결 초기화
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // SDP에 setup=actpass 설정 (WebRTC 연결 방식 지정)
      offer.sdp = this.setSdpSetupAttribute(offer.sdp || '');
      
      await this.peerConnection.setLocalDescription(offer);
      
      // 원격 설명 설정 - WebRTC는 P2P지만 지금은 로컬에서만 사용하므로 자체 연결
      const answer = await this.createSelfAnswer(offer);
      
      // SDP에 setup=active 설정 (WebRTC 연결 방식 지정)
      answer.sdp = this.setSdpSetupAttribute(answer.sdp || '', 'active');
      
      // 약간의 지연 후 원격 설명 설정 (연결 안정성 향상)
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.peerConnection.setRemoteDescription(answer);
      
      return true;
    } catch (error) {
      console.error('세션 초기화 오류:', error);
      this.handleError(new Error('세션을 초기화할 수 없습니다.'));
      return false;
    }
  }
  
  /**
   * SDP의 setup 속성을 설정하는 헬퍼 함수
   * @param sdp SDP 문자열
   * @param setupValue setup 속성값 ('active', 'passive', 'actpass' 중 하나)
   * @returns 수정된 SDP 문자열
   */
  private setSdpSetupAttribute(sdp: string, setupValue: 'active' | 'passive' | 'actpass' = 'actpass'): string {
    // SDP 문자열 라인으로 분리
    const lines = sdp.split('\r\n');
    let mediaIndex = -1;
    
    // 미디어 섹션 찾기
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=')) {
        mediaIndex = i;
        break;
      }
    }
    
    if (mediaIndex === -1) return sdp;
    
    // setup 속성이 있는지 확인하고 수정
    let hasSetup = false;
    for (let i = mediaIndex; i < lines.length; i++) {
      if (lines[i].startsWith('a=setup:')) {
        lines[i] = `a=setup:${setupValue}`;
        hasSetup = true;
        break;
      }
    }
    
    // setup 속성이 없는 경우 추가
    if (!hasSetup) {
      for (let i = mediaIndex; i < lines.length; i++) {
        if (lines[i].startsWith('a=mid:')) {
          // mid 속성 다음에 setup 속성 추가
          lines.splice(i + 1, 0, `a=setup:${setupValue}`);
          break;
        }
      }
    }
    
    return lines.join('\r\n');
  }
  
  /**
   * 자체 응답 생성 (로컬 테스트용)
   */
  private async createSelfAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const tempPeerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    try {
      await tempPeerConnection.setRemoteDescription(offer);
      const answer = await tempPeerConnection.createAnswer();
      await tempPeerConnection.setLocalDescription(answer);
      
      return answer;
    } finally {
      tempPeerConnection.close();
    }
  }
  
  /**
   * 미디어 스트림 시작 (오디오/비디오/화면)
   */
  public async startMediaStream(config: MediaStreamConfig): Promise<boolean> {
    try {
      console.log('미디어 스트림 시작 요청:', config);
      
      // 오디오 스트림 시작
      if (config.audio && !this.state.isAudioActive) {
        try {
          await this.startAudioStream();
          // 음성 인식은 startAudioStream 내부에서 처리됨
        } catch (audioError) {
          console.error('오디오 스트림 시작 중 오류:', audioError);
          this.sendMessage({
            type: 'system-info',
            content: '마이크 활성화 중 오류가 발생했습니다. 브라우저 설정에서 마이크 권한을 확인해주세요.',
            timestamp: new Date()
          });
          // 다른 미디어는 계속 시도
        }
      }
      
      // 비디오 스트림 시작
      if (config.video && !this.state.isVideoActive) {
        try {
          await this.startVideoStream();
        } catch (videoError) {
          console.error('비디오 스트림 시작 중 오류:', videoError);
          // 다른 미디어는 계속 시도
        }
      }
      
      // 화면 스트림 시작
      if (config.screen && !this.state.isScreenActive) {
        try {
          await this.startScreenStream();
        } catch (screenError) {
          console.error('화면 공유 스트림 시작 중 오류:', screenError);
          // 다른 미디어는 계속 시도
        }
      }
      
      // 화면 캡처 시작
      if (config.screen && this.state.isScreenActive) {
        try {
          this.startScreenCapture();
        } catch (captureError) {
          console.error('화면 캡처 시작 중 오류:', captureError);
        }
      }
      
      return true;
    } catch (error) {
      console.error('미디어 스트림 시작 오류:', error);
      this.handleError(error as Error);
      return false;
    }
  }
  
  /**
   * 오디오 스트림 시작
   */
  private async startAudioStream(): Promise<void> {
    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.localAudioStream.getAudioTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localAudioStream as MediaStream);
      });
      
      this.updateState({ isAudioActive: true });
      
      // 약간의 지연 후 음성 인식 시작 (마이크가 완전히 초기화된 후)
      setTimeout(() => {
        if (this.state.isAudioActive) {
          // 음성 인식 안전하게 시작
          this.safeStartSpeechRecognition();
        }
      }, 500);
    } catch (error) {
      console.error('오디오 스트림 시작 오류:', error);
      
      // 권한 오류 메시지 표시
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.sendMessage({
          type: 'system-info',
          content: '마이크 접근 권한이 없습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.',
          timestamp: new Date()
        });
      }
      
      throw error;
    }
  }
  
  /**
   * 비디오 스트림 시작
   */
  private async startVideoStream(): Promise<void> {
    try {
      // 기존 스트림이 있다면 모든 트랙 중지
      if (this.localVideoStream) {
        this.localVideoStream.getTracks().forEach(track => track.stop());
      }
      
      // 간단한 비디오 설정으로 시작
      const constraints = {
        video: true,  // 가장 기본 설정으로 먼저 시도
        audio: false
      };
      
      console.log('비디오 스트림 요청 중...');
      
      // navigator.mediaDevices 존재 여부 확인
      if (!navigator.mediaDevices) {
        throw new Error('현재 브라우저에서 mediaDevices API를 지원하지 않습니다');
      }
      
      this.localVideoStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('비디오 스트림 획득 성공');
      
      // 트랙 추가 및 연결
      const videoTracks = this.localVideoStream.getVideoTracks();
      console.log(`비디오 트랙 수: ${videoTracks.length}`);
      
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
          // 트랙 상태 확인 및 로깅
          console.log(`비디오 트랙: ${track.label}, 상태: ${track.readyState}, 활성화: ${track.enabled}`);
          
          // 명시적으로 트랙 활성화
          track.enabled = true;
          
          // 피어 연결에 트랙 추가
          this.peerConnection?.addTrack(track, this.localVideoStream as MediaStream);
        });
        
        this.updateState({ isVideoActive: true });
      } else {
        console.warn('비디오 트랙이 없습니다');
        throw new Error('비디오 트랙을 찾을 수 없습니다');
      }
    } catch (error) {
      console.error('비디오 스트림 시작 오류:', error);
      
      // 사용자에게 권한 오류 알림
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.sendMessage({
          type: 'system-info',
          content: '카메라 접근 권한이 없습니다. 브라우저 설정에서 카메라 권한을 허용해주세요. Mac 사용자의 경우 시스템 환경설정 > 보안 및 개인정보 보호에서 확인하세요.',
          timestamp: new Date()
        });
      } else {
        // 기타 오류
        this.sendMessage({
          type: 'system-info',
          content: `카메라 접근 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          timestamp: new Date()
        });
      }
      
      throw error;
    }
  }
  
  /**
   * 화면 공유 스트림 시작
   */
  private async startScreenStream(): Promise<void> {
    try {
      // 기존 스트림이 있다면 모든 트랙 중지
      if (this.localScreenStream) {
        this.localScreenStream.getTracks().forEach(track => track.stop());
      }
      
      console.log('화면 공유 요청 중...');
      
      // 최소한의 옵션으로 화면 공유 요청
      this.localScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      
      console.log('화면 공유 스트림 획득 성공');
      
      // 트랙 정보 확인 및 처리
      const screenTracks = this.localScreenStream.getVideoTracks();
      console.log(`화면 공유 트랙 수: ${screenTracks.length}`);
      
      if (screenTracks.length > 0) {
        screenTracks.forEach(track => {
          // 트랙 종료 이벤트 처리
          track.onended = () => {
            console.log('사용자가 화면 공유를 중지했습니다');
            this.stopScreenStream();
          };
          
          // 트랙 상태 확인 및 로깅
          console.log(`화면 공유 트랙: ${track.label}, 상태: ${track.readyState}, 활성화: ${track.enabled}`);
          
          // 명시적으로 트랙 활성화
          track.enabled = true;
          
          // 피어 연결에 트랙 추가
          this.peerConnection?.addTrack(track, this.localScreenStream as MediaStream);
        });
        
        // 화면 공유 시작 상태 업데이트
        this.updateState({ isScreenActive: true });
        
        // 화면 캡처 시작
        this.startScreenCapture();
      } else {
        console.warn('화면 공유 트랙이 없습니다');
        throw new Error('화면 공유 트랙을 찾을 수 없습니다');
      }
    } catch (error) {
      console.error('화면 공유 스트림 시작 오류:', error);
      
      // 사용자에게 권한 오류 메시지 표시
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.sendMessage({
          type: 'system-info',
          content: '화면 공유 권한이 거부되었습니다. 브라우저 설정에서 화면 공유 권한을 허용해주세요. Mac 사용자의 경우 시스템 환경설정에서 화면 녹화 권한을 확인하세요.',
          timestamp: new Date()
        });
      } else {
        // 기타 오류에 대한 메시지 표시
        this.sendMessage({
          type: 'system-info',
          content: `화면 공유 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          timestamp: new Date()
        });
      }
      
      throw error;
    }
  }
  
  /**
   * 화면 캡처 시작
   */
  private startScreenCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }
    
    this.captureInterval = setInterval(() => {
      this.captureScreenFrame();
    }, this.capturePeriod);
  }
  
  /**
   * 화면 프레임 캡처
   */
  private async captureScreenFrame(): Promise<void> {
    if (!this.localScreenStream || !this.state.isScreenActive) return;
    
    try {
      const videoTrack = this.localScreenStream.getVideoTracks()[0];
      
      if (videoTrack && typeof window !== 'undefined' && 'ImageCapture' in window) {
        // @ts-ignore - 브라우저 API 타입 문제 해결
        const imageCapture = new window.ImageCapture(videoTrack);
        
        // 비트맵 캡처
        const bitmap = await imageCapture.grabFrame();
        
        // 캔버스에 비트맵 렌더링
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        
        const context = canvas.getContext('2d');
        context?.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
        
        // 이미지 데이터를 Base64로 변환 (명확한 형식으로)
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64Data = imageDataUrl.split(',')[1]; // 접두사 제거
        
        if (!base64Data) {
          console.error('이미지 데이터 변환 실패');
          return;
        }
        
        // 음성 인식 결과 가져오기
        const speechText = this.speechToTextResult;
        
        // 이미지와 음성 분석
        if (speechText) {
          await this.analyzeScreenAndSpeech(base64Data, speechText);
          // 분석 후 음성 인식 결과 초기화
          this.speechToTextResult = '';
        }
      } else {
        console.warn('ImageCapture API를 지원하지 않는 브라우저입니다.');
      }
    } catch (error) {
      console.error('화면 캡처 오류:', error);
    }
  }
  
  /**
   * 화면과 음성 분석
   */
  private async analyzeScreenAndSpeech(imageData: string, speechText: string): Promise<void> {
    if (!API_KEY) {
      console.error('API 키가 설정되지 않았습니다.');
      return;
    }
    
    // 처리 중 상태 업데이트
    this.updateState({ isProcessing: true });
    
    try {
      const model = new GoogleGenerativeAI(API_KEY).getGenerativeModel({ 
        model: "gemini-1.5-pro",
        safetySettings
      });
      
      // 시스템 프롬프트 구성
      const systemPrompt = `당신은 AI 튜터입니다. 학생에게 ${this.subject}(${this.level} 수준)를 가르치고 있습니다.
다음 지침을 따라주세요:
1. 답변은 간결하고 명확하게 작성하세요. 불필요한 설명은 줄이고 핵심만 전달하세요.
2. 3-4문장 이내로 짧게 답변하세요. 학생이 소화하기 쉬운 분량이 중요합니다.
3. 공유된 화면을 분석하고 학생의 질문에 직접적으로 답하세요.
4. 전문 용어는 필요한 경우에만 사용하고, 가능한 쉽게 설명하세요.
5. 질문에 대한 직접적인 해결책을 제시하세요.`;
      
      // 대화 히스토리 변환
      const geminiHistory = convertToGeminiHistory(this.messageHistory);
      
      // 채팅 세션 생성
      const chat = model.startChat({
        history: geminiHistory,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256, // 간결한 응답을 위해 토큰 수 제한
        },
      });
      
      // 사용자 메시지 구성
      let userMessage = '현재 화면을 분석해주세요.';
      
      if (speechText) {
        userMessage = `학생 질문: ${speechText}\n\n화면을 분석하고 이 질문에 답해주세요.`;
        
        // 사용자 메시지를 히스토리에 추가
        this.messageHistory.push({
          role: 'user',
          content: userMessage
        });
        
        // 메시지 이벤트 발생
        this.sendMessage({
          type: 'user-message',
          content: userMessage,
          timestamp: new Date()
        });
      }
      
      // API 호출 전 에러 대비 (쿼터 초과 등)
      try {
        // 이미지 데이터 구성 - Base64 형식으로 명확하게 제공
        const imageParts = [
          {
            text: userMessage
          },
          {
            inlineData: {
              data: imageData,
              mimeType: 'image/jpeg'
            }
          }
        ];
        
        const result = await model.generateContent([
          { text: systemPrompt },
          ...imageParts
        ]);
        
        const responseText = result.response.text();
        
        // 튜터 응답을 히스토리에 추가
        this.messageHistory.push({
          role: 'tutor',
          content: responseText
        });
        
        // 응답 메시지 이벤트 발생
        this.sendMessage({
          type: 'tutor-message',
          content: responseText,
          timestamp: new Date()
        });
        
        // 음성으로 응답 (간결한 응답을 위해 최적화됨)
        this.speakResponse(responseText);
        
        // 세션 데이터 저장
        this.saveSession();
      } catch (apiError) {
        console.error('AI 응답 생성 오류:', apiError);
        
        // 오류 메시지 생성
        const errorMessage = '화면 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        
        // 오류 메시지 이벤트 발생
        this.sendMessage({
          type: 'system-info',
          content: errorMessage,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('화면 분석 처리 오류:', error);
    } finally {
      this.updateState({ isProcessing: false });
    }
  }
  
  /**
   * 음성 인식 설정
   */
  private setupSpeechRecognition(): void {
    if (!this.speechRecognition) return;
    
    console.log('음성 인식 이벤트 핸들러 설정 중');
    
    // 결과 처리
    this.speechRecognition.onresult = (event: any) => {
      const results = event.results;
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < results.length; i++) {
        const transcript = results[i][0].transcript;
        
        if (results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        this.speechToTextResult = finalTranscript;
        
        // 메시지 이벤트 발생
        this.sendMessage({
          type: 'speech-text',
          content: finalTranscript,
          interim: false,
          timestamp: new Date()
        });
      } else if (interimTranscript) {
        // 중간 결과 이벤트 발생
        this.sendMessage({
          type: 'speech-text',
          content: interimTranscript,
          interim: true,
          timestamp: new Date()
        });
      }
    };
    
    // 오류 처리
    this.speechRecognition.onerror = (event: any) => {
      console.warn('음성 인식 오류:', event.error, '메시지:', event.message);
      
      // no-speech 오류는 무시하고 자동으로 계속 진행
      if (event.error === 'no-speech') {
        return; // 단순히 무시
      }
      
      // 권한 오류
      if (event.error === 'not-allowed') {
        this.sendMessage({
          type: 'system-info',
          content: '마이크 접근 권한이 없습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.',
          timestamp: new Date()
        });
      }
    };
    
    // 음성 인식 종료 시 자동 재시작 - 간소화된 핸들러
    this.speechRecognition.onend = () => {
      console.log('음성 인식 세션 종료됨');
      
      // 이미 오디오가 비활성화되었다면 재시작하지 않음
      if (!this.state.isAudioActive) {
        console.log('오디오가 비활성화되어 음성 인식을 재시작하지 않음');
        return;
      }
      
      // 기존 인스턴스 참조를 null로 설정하여 다음 시작에서 새 인스턴스 생성되게 함
      this.speechRecognition = null;
      
      // 지연 후 안전 시작 함수 호출
      setTimeout(() => {
        if (this.state.isAudioActive) {
          console.log('음성 인식 자동 재시작');
          this.safeStartSpeechRecognition();
        }
      }, 1000);
    };
    
    console.log('음성 인식 이벤트 핸들러 설정 완료');
  }
  
  /**
   * 음성 인식 안전하게 시작
   * 상태를 명확하게 관리하고 오류를 방지하는 접근 방식 사용
   */
  private safeStartSpeechRecognition(): void {
    if (typeof window === 'undefined') return;
    
    console.log('음성 인식 안전 시작 함수 호출됨');
    
    // 음성 인식 인스턴스가 존재하면 완전히 새로 생성하기 전에 정리
    if (this.speechRecognition) {
      try {
        console.log('기존 음성 인식 인스턴스 정리 중...');
        
        // 이벤트 핸들러를 모두 제거 (메모리 누수 방지)
        this.speechRecognition.onresult = null;
        this.speechRecognition.onerror = null; 
        this.speechRecognition.onend = null;
        
        // 실행 중이면 중지 시도
        this.speechRecognition.stop();
        console.log('기존 음성 인식 중지됨');
      } catch (err) {
        console.log('음성 인식 정리 중 오류 (무시됨)');
      }
      
      // 참조 해제
      this.speechRecognition = null;
    }
    
    // 충분한 지연 후 새 인스턴스 생성
    setTimeout(() => {
      try {
        // 여전히 오디오가 활성화된 상태인지 확인
        if (!this.state.isAudioActive) {
          console.log('오디오가 비활성화됨 - 음성 인식 시작하지 않음');
          return;
        }
        
        console.log('새 음성 인식 인스턴스 생성 중...');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          console.error('이 브라우저는 음성 인식을 지원하지 않습니다');
          return;
        }
        
        // 새 인스턴스 생성
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'ko-KR';
        
        // 이벤트 핸들러 설정
        this.setupSpeechRecognition();
        
        // 추가 지연 후 시작 시도
        setTimeout(() => {
          if (this.state.isAudioActive && this.speechRecognition) {
            try {
              console.log('새 음성 인식 시작 중...');
              this.speechRecognition.start();
              console.log('새 음성 인식 시작됨');
            } catch (startError) {
              console.error('음성 인식 시작 오류:', startError);
              // 오류 발생 시 참조 해제하여 다음 시도에서 완전히 새로 생성하도록 함
              this.speechRecognition = null;
            }
          }
        }, 300); // 추가 지연
        
      } catch (error) {
        console.error('음성 인식 설정 오류:', error);
        this.speechRecognition = null;
      }
    }, 500); // 기존 인스턴스 정리 후 지연
  }
  
  /**
   * 텍스트를 음성으로 변환하여 말하기
   */
  private speakResponse(text: string): void {
    try {
      // 음성 합성이 없거나 SpeechSynthesis API가 지원되지 않으면 종료
      if (!this.speechSynthesis || !window.speechSynthesis) {
        console.log('음성 합성 API를 사용할 수 없습니다.');
        return;
      }
      
      // 진행 중인 모든 음성 합성 중지
      window.speechSynthesis.cancel();
      
      this.updateState({ isSpeaking: true });
      
      // 매번 새로운 인스턴스 생성 (일관성 향상)
      this.speechSynthesis = new SpeechSynthesisUtterance();
      
      // 합성 설정
      this.speechSynthesis.text = text;
      this.speechSynthesis.lang = 'ko-KR';
      this.speechSynthesis.rate = 1.2; // 속도를 1.3에서 1.2로 약간 낮춤 (안정성 향상)
      this.speechSynthesis.pitch = 1.0;
      this.speechSynthesis.volume = 1.0;
      
      // 이벤트 핸들러 설정
      this.speechSynthesis.onend = () => {
        console.log('음성 합성 완료됨');
        this.updateState({ isSpeaking: false });
      };
      
      this.speechSynthesis.onerror = (event) => {
        // 더 자세한 오류 정보 출력 (타입 안전하게 처리)
        console.error('음성 합성 오류:', {
          error: event.error,
          // 일부 속성은 브라우저에 따라 다를 수 있으므로 안전하게 확인
          detail: event
        });
        
        // 튜터 메시지로 오류 알림
        this.sendMessage({
          type: 'system-info',
          content: `음성 출력에 문제가 발생했습니다. 텍스트로 대화를 계속하세요.`,
          timestamp: new Date()
        });
        
        this.updateState({ isSpeaking: false });
      };
      
      // 음성 출력 시도
      console.log('음성 합성 시작');
      window.speechSynthesis.speak(this.speechSynthesis);
      
      // 음성 합성이 시작되었는지 확인 (일부 브라우저에서 버그 발생)
      setTimeout(() => {
        // 음성 합성이 여전히 활성 상태인지 확인
        if (this.state.isSpeaking && !window.speechSynthesis.speaking) {
          console.log('음성 합성이 시작되지 않아 강제로 중지합니다');
          this.updateState({ isSpeaking: false });
        }
      }, 1000);
      
    } catch (error) {
      console.error('음성 합성 처리 중 예외 발생:', error);
      this.updateState({ isSpeaking: false });
    }
  }
  
  /**
   * 데이터 채널 설정
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return;
    
    this.dataChannel.onopen = () => {
      console.log('데이터 채널이 열렸습니다.');
      
      // 초기 메시지 전송
      this.sendMessage({
        type: 'system-info',
        content: '튜터 세션이 시작되었습니다.',
        timestamp: new Date()
      });
    };
    
    this.dataChannel.onclose = () => {
      console.log('데이터 채널이 닫혔습니다.');
    };
    
    this.dataChannel.onerror = (error) => {
      console.error('데이터 채널 오류:', error);
      this.handleError(new Error('데이터 채널 오류'));
    };
    
    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (this.handlers.onMessage) {
          this.handlers.onMessage(message);
        }
      } catch (error) {
        console.error('메시지 처리 오류:', error);
      }
    };
  }
  
  /**
   * 메시지 전송
   */
  private sendMessage(message: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    }
    
    if (this.handlers.onMessage) {
      this.handlers.onMessage(message);
    }
  }
  
  /**
   * 상태 업데이트
   */
  private updateState(newState: Partial<MediaStreamSessionState>): void {
    this.state = { ...this.state, ...newState };
    
    if (this.handlers.onStateChange) {
      this.handlers.onStateChange(this.state);
    }
  }
  
  /**
   * 오류 처리
   */
  private handleError(error: Error): void {
    if (this.handlers.onError) {
      this.handlers.onError(error);
    }
  }
  
  /**
   * 학습 활동 기록
   */
  private recordActivity(type: string): void {
    if (!this.userId) return;
    
    // analytics.ts에 정의된 학습 활동 타입만 사용
    let activityType: LearningActivityType = 'session_start';
    
    // 입력된 타입에 따라 적절한 LearningActivityType으로 매핑
    switch(type) {
      case 'session_start':
        activityType = 'session_start';
        break;
      case 'session_complete':
        activityType = 'session_complete';
        break;
      case 'message_sent':
        activityType = 'message_sent';
        break;
      default:
        activityType = 'resource_viewed';
    }
    
    recordLearningActivity({
      userId: this.userId,
      type: activityType,
      details: {
        sessionId: this.sessionId,
        duration: 0,
        messageCount: this.messageHistory.length
      }
    }).catch(err => console.error('학습 활동 기록 오류:', err));
  }
  
  /**
   * 세션 저장
   */
  private saveSession(): void {
    if (!this.userId || !this.sessionId) return;
    
    // Firestore에 맞는 타입으로 데이터 변환
    const sessionData = {
      userId: this.userId,
      subject: this.subject,
      level: this.level,
      messages: this.messageHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: Timestamp.fromDate(new Date())
      })),
      isActive: true,
      goal: `${this.subject} 학습 (${this.level} 수준)`,
      isCompleted: false,
      createdAt: Timestamp.fromDate(new Date()),
      lastUpdatedAt: serverTimestamp() // Firestore 서버 타임스탬프 사용
    };
    
    // setDoc 사용 (문서가 없으면 생성, 있으면 업데이트)
    setDoc(doc(db, 'sessions', this.sessionId), sessionData)
      .catch((err: Error) => {
        console.error('세션 저장 오류:', err);
        console.warn('세션 저장에 실패했습니다. 사용자 세션을 다시 확인해주세요.');
      });
  }
  
  /**
   * 오디오 스트림 중지
   */
  public stopAudioStream(): void {
    console.log('오디오 스트림 중지 함수 호출됨');
    
    // 먼저 현재 상태 업데이트 (UI 즉시 반영)
    this.updateState({ isAudioActive: false });
    
    // 음성 인식 중지
    if (this.speechRecognition) {
      try {
        // 이벤트 핸들러 모두 제거
        console.log('음성 인식 이벤트 핸들러 제거 중');
        this.speechRecognition.onresult = null;
        this.speechRecognition.onerror = null;
        this.speechRecognition.onend = null;
        
        // 중지 시도
        console.log('음성 인식 중지 시도');
        this.speechRecognition.stop();
        console.log('음성 인식 중지됨');
      } catch (error) {
        console.log('음성 인식 중지 오류 (무시됨):', error);
      } finally {
        // 무조건 참조 해제
        this.speechRecognition = null;
      }
    }
    
    // 트랙 중지 및 상태 업데이트
    if (this.localAudioStream) {
      console.log('오디오 트랙 중지 중');
      this.localAudioStream.getTracks().forEach(track => {
        track.stop();
        console.log(`오디오 트랙 중지됨: ${track.kind}`);
      });
      
      // 스트림 참조 해제
      this.localAudioStream = null;
    }
  }
  
  /**
   * 비디오 스트림 중지
   */
  public stopVideoStream(): void {
    if (this.localVideoStream) {
      this.localVideoStream.getVideoTracks().forEach(track => track.stop());
      this.updateState({ isVideoActive: false });
    }
  }
  
  /**
   * 화면 공유 스트림 중지
   */
  public stopScreenStream(): void {
    if (this.localScreenStream) {
      this.localScreenStream.getVideoTracks().forEach(track => track.stop());
      this.updateState({ isScreenActive: false });
    }
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }
  
  /**
   * 세션 종료
   */
  public close(): void {
    this.stopAudioStream();
    this.stopVideoStream();
    this.stopScreenStream();
    
    // 데이터 채널 닫기
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    // RTCPeerConnection 닫기
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    // 음성 합성 중지
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // 학습 활동 기록 (세션 종료)
    this.recordActivity('session_complete');
    
    this.updateState({
      isConnected: false,
      isAudioActive: false,
      isVideoActive: false,
      isScreenActive: false,
      isProcessing: false,
      isSpeaking: false
    });
  }
  
  /**
   * 세션 상태 가져오기
   */
  public getState(): MediaStreamSessionState {
    return this.state;
  }
  
  /**
   * 메시지 히스토리 가져오기
   */
  public getMessageHistory(): { role: 'user' | 'model' | 'tutor' | 'system'; content: string }[] {
    return this.messageHistory;
  }
  
  /**
   * 로컬 스트림 가져오기
   */
  public getLocalStreams(): {
    audio: MediaStream | null;
    video: MediaStream | null;
    screen: MediaStream | null;
  } {
    return {
      audio: this.localAudioStream,
      video: this.localVideoStream,
      screen: this.localScreenStream
    };
  }
  
  /**
   * 원격 스트림 가져오기
   */
  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

/**
 * 미디어 세션 데이터 저장 인터페이스
 */
export interface MediaSessionData {
  userId: string;
  subject: string;
  level: string;
  messages: { role: string; content: string; timestamp: Date }[];
  isActive: boolean;
  goal: string;
  isCompleted: boolean;
  createdAt: Date;
  lastUpdatedAt: Date;
}

/**
 * 미디어 세션 저장 (외부에서 접근용)
 */
export const saveMediaSession = async (sessionId: string, data: MediaSessionData): Promise<boolean> => {
  try {
    await setDoc(doc(db, 'sessions', sessionId), data);
    return true;
  } catch (error) {
    console.error('미디어 세션 저장 오류:', error);
    return false;
  }
}; 