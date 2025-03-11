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

interface VideoChatProps {
  isActive: boolean;
  onError: (message: string) => void;
  audioRequired: boolean;
  onAudioNeeded: () => Promise<boolean>;
  audioState: AudioState;
  screenSharingActive?: boolean;
  onStopScreenShare?: () => void;
}

export const VideoChat: React.FC<VideoChatProps> = ({ 
  isActive, 
  onError, 
  audioRequired, 
  onAudioNeeded,
  audioState,
  screenSharingActive = false,
  onStopScreenShare
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  
  // 카메라 활성화/비활성화 함수
  const toggleCamera = async () => {
    try {
      if (!cameraActive) {
        // 화면 공유가 활성화되어 있으면 먼저 중지
        if (screenSharingActive && onStopScreenShare) {
          onStopScreenShare();
        }
        
        // 오디오가 필수이고 활성화되지 않은 경우 먼저 오디오 활성화
        if (audioRequired && !audioState.active) {
          const audioStarted = await onAudioNeeded();
          if (!audioStarted) {
            onError("튜터링을 위해 마이크 접근 권한이 필요합니다. 마이크를 먼저 활성화해주세요.");
            return;
          }
        }
        
        // 모든 운영체제에서 작동하는 일관된 방식으로 카메라 스트림 요청
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        });
        
        // 로컬 비디오 요소에 스트림 연결
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // 카메라 정보 가져오기
        const videoTrack = stream.getVideoTracks()[0];
        setDeviceInfo(videoTrack.label || "Unknown Camera");
        
        setCameraActive(true);
      } else {
        // 카메라 비활성화
        const stream = localVideoRef.current?.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
        }
        setCameraActive(false);
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      
      // 권한 거부 오류 처리
      if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
        setCameraPermissionDenied(true);
        onError("카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
      } else {
        onError(`카메라를 활성화하는 중 오류가 발생했습니다: ${error.message}`);
      }
    }
  };
  
  // 컴포넌트 활성화 시 자동 실행
  useEffect(() => {
    if (isActive && !cameraActive && !cameraPermissionDenied) {
      // 자동으로 카메라 켜기 시도하지 않음 - 사용자가 직접 켜도록 유도
    }
  }, [isActive]);
  
  // 컴포넌트 마운트 해제 시 리소스 정리
  useEffect(() => {
    return () => {
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  return (
    <div className="video-chat-container">
      <div className="video-area">
        {cameraActive ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="local-video"
          />
        ) : (
          <div className={cameraPermissionDenied ? "camera-permission-denied" : "video-placeholder"}>
            {cameraPermissionDenied ? (
              <div className="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>카메라 접근이 거부되었습니다.</p>
                <p className="text-sm mt-2">브라우저 설정에서 카메라 권한을 허용해주세요.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>카메라가 비활성화되어 있습니다.</p>
                <p className="text-sm mt-1 text-gray-400">아래 버튼을 클릭하여 카메라를 켜세요.</p>
              </div>
            )}
          </div>
        )}
        
        {/* 카메라 활성화 시 디바이스 정보 표시 */}
        {cameraActive && deviceInfo && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded">
            {deviceInfo}
          </div>
        )}
        
        {/* 컨트롤 버튼 - 비디오 영역 내부 하단에 배치 */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <button
            onClick={toggleCamera}
            disabled={cameraPermissionDenied}
            className={`camera-toggle ${cameraActive ? 'active' : 'inactive'} px-3 py-1 text-sm rounded-full shadow-lg`}
          >
            {cameraActive ? (
              <>
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  카메라 끄기
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  카메라 켜기
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 