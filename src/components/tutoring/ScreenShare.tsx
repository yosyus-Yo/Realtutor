'use client';

import React, { useEffect, useRef, useState } from 'react';

// AudioState 인터페이스 정의
interface AudioState {
  stream: MediaStream | null;
  active: boolean;
  deviceInfo: string;
  volume: number;
  isSpeaking: boolean;
}

interface ScreenShareProps {
  isActive: boolean;
  onError: (message: string) => void;
  audioRequired: boolean;
  onAudioNeeded: () => Promise<boolean>;
  audioState: AudioState;
  cameraActive?: boolean;
  onStopCamera?: () => void;
}

// TypeScript 정의 확장
interface DisplayMediaStreamOptions extends MediaStreamConstraints {
  video?: boolean | MediaTrackConstraints & {
    cursor?: string;
    displaySurface?: string;
  };
}

export const ScreenShare: React.FC<ScreenShareProps> = ({ 
  isActive, 
  onError, 
  audioRequired, 
  onAudioNeeded,
  audioState,
  cameraActive = false,
  onStopCamera
}) => {
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  
  const startScreenShare = async () => {
    try {
      // 카메라가 활성화되어 있으면 먼저 중지
      if (cameraActive && onStopCamera) {
        onStopCamera();
      }
      
      // 오디오가 필수이고 활성화되지 않은 경우 먼저 오디오 활성화
      if (audioRequired && !audioState.active) {
        const audioStarted = await onAudioNeeded();
        if (!audioStarted) {
          onError("튜터링을 위해 마이크 접근 권한이 필요합니다. 마이크를 먼저 활성화해주세요.");
          return;
        }
      }
      
      // 모든 브라우저에서 작동하는 화면 공유 방식
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          cursor: "always",
          displaySurface: "monitor" // 이제 타입 오류 없음
        },
        audio: false // 오디오는 별도로 처리
      } as DisplayMediaStreamOptions);
      
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.playsInline = true;
        await screenVideoRef.current.play().catch(e => {
          console.error("화면 공유 비디오 재생 오류:", e);
          onError("화면 공유 비디오 재생 시작에 실패했습니다.");
        });
      }
      
      // 화면 공유 중단 이벤트 처리
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      setActiveStream(stream);
      setScreenSharing(true);
    } catch (error) {
      console.error("화면 공유 오류:", error);
      onError("화면 공유를 시작할 수 없습니다. 브라우저 설정을 확인해주세요.");
    }
  };
  
  const stopScreenShare = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }
      setActiveStream(null);
      setScreenSharing(false);
    }
  };
  
  // 컴포넌트 마운트 해제 시 리소스 정리
  useEffect(() => {
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeStream]);
  
  return (
    <div className="screen-share-container">
      <div className="screen-area">
        {screenSharing ? (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="screen-video"
          />
        ) : (
          <div className="screen-placeholder">
            <div className="flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p>화면 공유가 비활성화되어 있습니다.</p>
              <p className="text-sm mt-1 text-gray-400">아래 버튼을 클릭하여 화면 공유를 시작하세요.</p>
            </div>
          </div>
        )}
        
        {/* 컨트롤 버튼 - 화면 공유 영역 내부 하단에 배치 */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <button
            onClick={screenSharing ? stopScreenShare : startScreenShare}
            disabled={audioRequired && !audioState.active}
            className={`screen-toggle ${screenSharing ? 'active' : 'inactive'} px-3 py-1 text-sm rounded-full shadow-lg`}
          >
            {screenSharing ? (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                화면 공유 중지
              </span>
            ) : (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                화면 공유 시작
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 