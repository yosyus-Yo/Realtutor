// Web Speech API를 사용한 음성 인식 및 합성 유틸리티

// 브라우저 호환성 체크
export const isSpeechRecognitionSupported = () => {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
};

export const isSpeechSynthesisSupported = () => {
  return 'speechSynthesis' in window;
};

// 음성 합성 (Text-to-Speech)
export const speakText = (text: string, voiceIndex = 0, rate = 1, pitch = 1, volume = 1): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isSpeechSynthesisSupported()) {
      reject(new Error('음성 합성이 지원되지 않는 브라우저입니다.'));
      return;
    }

    // 이미 말하고 있다면 중지
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 음성 목록 가져오기
    const voices = window.speechSynthesis.getVoices();
    
    // 음성이 로드되지 않았을 경우 다시 시도
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const updatedVoices = window.speechSynthesis.getVoices();
        if (updatedVoices.length > 0 && voiceIndex < updatedVoices.length) {
          utterance.voice = updatedVoices[voiceIndex];
        }
        
        utterance.rate = rate;     // 0.1 ~ 10
        utterance.pitch = pitch;   // 0 ~ 2
        utterance.volume = volume; // 0 ~ 1
        
        utterance.onend = () => resolve();
        utterance.onerror = (event) => reject(new Error(`음성 합성 오류: ${event.error}`));
        
        window.speechSynthesis.speak(utterance);
      };
    } else {
      if (voiceIndex < voices.length) {
        utterance.voice = voices[voiceIndex];
      }
      
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(`음성 합성 오류: ${event.error}`));
      
      window.speechSynthesis.speak(utterance);
    }
  });
};

// 사용 가능한 음성 목록 가져오기
export const getAvailableVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }
    
    const voices = window.speechSynthesis.getVoices();
    
    if (voices.length > 0) {
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices());
      };
    }
  });
};

// 한국어 음성 찾기
export const findKoreanVoice = async (): Promise<number> => {
  const voices = await getAvailableVoices();
  
  // 한국어 음성 찾기
  const koreanVoiceIndex = voices.findIndex(voice => 
    voice.lang.includes('ko') || voice.name.includes('Korean')
  );
  
  return koreanVoiceIndex > -1 ? koreanVoiceIndex : 0;
};

// 음성 인식 결과 타입
export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

// 음성 인식 콜백 타입
export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onResult?: (result: SpeechRecognitionResult) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// 음성 인식 (Speech-to-Text)
export class SpeechRecognizer {
  private recognition: any;
  private isListening: boolean = false;
  private callbacks: SpeechRecognitionCallbacks = {};
  
  constructor() {
    if (!isSpeechRecognitionSupported()) {
      throw new Error('음성 인식이 지원되지 않는 브라우저입니다.');
    }
    
    // SpeechRecognition 객체 생성
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // 설정
    this.recognition.lang = 'ko-KR';
    this.recognition.interimResults = true;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;
    
    // 이벤트 핸들러
    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.callbacks.onStart) this.callbacks.onStart();
    };
    
    this.recognition.onresult = (event: any) => {
      if (!this.callbacks.onResult) return;
      
      const resultIndex = event.resultIndex;
      const results = event.results;
      
      if (results[resultIndex]) {
        const transcript = results[resultIndex][0].transcript;
        const isFinal = results[resultIndex].isFinal;
        
        this.callbacks.onResult({
          transcript,
          isFinal
        });
      }
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.callbacks.onEnd) this.callbacks.onEnd();
    };
    
    this.recognition.onerror = (event: any) => {
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error(`음성 인식 오류: ${event.error}`));
      }
    };
  }
  
  // 음성 인식 시작
  public start(callbacks?: SpeechRecognitionCallbacks): void {
    if (callbacks) {
      this.callbacks = callbacks;
    }
    
    if (!this.isListening) {
      this.recognition.start();
    }
  }
  
  // 음성 인식 중지
  public stop(): void {
    if (this.isListening) {
      this.recognition.stop();
    }
  }
  
  // 음성 인식 일시정지 (새로운 결과 무시)
  public pause(): void {
    this.recognition.abort();
    this.isListening = false;
  }
  
  // 음성 인식 상태 확인
  public isRecognizing(): boolean {
    return this.isListening;
  }
  
  // 언어 설정
  public setLanguage(langCode: string): void {
    this.recognition.lang = langCode;
  }
}

// 타입 정의 추가
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
} 