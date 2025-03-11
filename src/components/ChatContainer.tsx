'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageWithCode } from './tutoring/CodeBlock';
import SpeechRecognitionButton from './tutoring/SpeechRecognitionButton';
import { speakText, findKoreanVoice, isSpeechSynthesisSupported } from '@/lib/utils/speech';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'tutor';
  timestamp?: Date;
}

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isProcessing?: boolean;
  onImageUpload?: (file: File) => void;
}

export default function ChatContainer({
  messages,
  onSendMessage,
  isProcessing = false,
  onImageUpload
}: ChatContainerProps) {
  const [input, setInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [koreanVoiceIndex, setKoreanVoiceIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 메시지가 추가될 때 스크롤 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 한국어 음성 인덱스 찾기
  useEffect(() => {
    async function loadKoreanVoice() {
      const voiceIndex = await findKoreanVoice();
      setKoreanVoiceIndex(voiceIndex);
    }
    
    if (typeof window !== 'undefined' && isSpeechSynthesisSupported()) {
      loadKoreanVoice();
    }
  }, []);

  // 메시지 전송 처리
  const handleSendMessage = () => {
    if (!input.trim() || isProcessing) return;
    
    onSendMessage(input.trim());
    setInput('');
  };

  // 메시지 음성 재생
  const handleSpeakMessage = async (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      return;
    }
    
    try {
      setIsSpeaking(true);
      
      // 코드 블록 제거 (음성으로 읽지 않음)
      const textWithoutCode = text.replace(/```[\s\S]*?```/g, '코드 블록 생략');
      
      await speakText(textWithoutCode, koreanVoiceIndex, 1, 1, 1);
    } catch (error) {
      console.error('음성 합성 오류:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  // 이미지 업로드 처리
  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-[60vh] overflow-y-auto p-4 space-y-4" id="message-container">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-tr-none'
                    : 'bg-gray-100 dark:bg-gray-700/70 text-gray-800 dark:text-gray-200 rounded-tl-none'
                }`}
              >
                <MessageWithCode content={message.content} />
                
                {message.timestamp && (
                  <div className="flex items-center justify-end gap-2 mt-2">
                    {message.role === 'tutor' && typeof window !== 'undefined' && isSpeechSynthesisSupported() && (
                      <button 
                        onClick={() => handleSpeakMessage(message.content)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        title="텍스트 읽기"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        </svg>
                      </button>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {message.timestamp.toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="메시지를 입력하세요..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 disabled:opacity-70"
          />
          <button
            onClick={handleSendMessage}
            disabled={isProcessing || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                처리 중
              </span>
            ) : (
              '전송'
            )}
          </button>
        </div>
        <div className="flex justify-center mt-4">
          <div className="flex gap-2">
            <SpeechRecognitionButton 
              onResult={(text) => setInput(prev => prev + text)}
            />
            {onImageUpload && (
              <button 
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                onClick={handleImageUpload}
                disabled={isProcessing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 