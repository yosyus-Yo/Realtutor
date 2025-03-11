'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AudioControlsProps {
  isActive: boolean;
  onError: (message: string) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({ isActive, onError }) => {
  const [audioActive, setAudioActive] = useState(false);
  const [audioPermissionDenied, setAudioPermissionDenied] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [volume, setVolume] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // 오디오 레벨 시각화를 위한 설정
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const animationFrame = useRef<number | null>(null);
  
  // 오디오 스트림 시작/중지
  const toggleAudio = async () => {
    try {
      if (!audioActive) {
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
        if (audioTrack) {
          setDeviceInfo(`마이크: ${audioTrack.label}`);
        }
        
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 256;
        
        const source = audioContext.current.createMediaStreamSource(newStream);
        source.connect(analyser.current);
        
        const bufferLength = analyser.current.frequencyBinCount;
        dataArray.current = new Uint8Array(bufferLength);
        
        // 시각화 시작
        startVisualization();
        
        setStream(newStream);
        setAudioActive(true);
        setAudioPermissionDenied(false);
      } else {
        // 오디오 스트림 종료
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        stopVisualization();
        setStream(null);
        setAudioActive(false);
        setVolume(0);
        setDeviceInfo('');
      }
    } catch (error) {
      console.error("오디오 접근 오류:", error);
      setAudioPermissionDenied(true);
      onError("마이크 접근이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.");
    }
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
        setVolume(avg); // 0-255 사이의 값
        
        // 음성 감지
        setIsSpeaking(avg > 30); // 임계값 조정 가능
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
  
  // 컴포넌트 마운트 해제 시 리소스 정리
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      stopVisualization();
      
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close();
      }
    };
  }, [stream]);
  
  return (
    <div className="audio-controls-container">
      {audioPermissionDenied ? (
        <div className="audio-permission-denied">
          <p>마이크 접근이 거부되었습니다.</p>
          <p>브라우저 설정에서 마이크 권한을 허용해주세요.</p>
        </div>
      ) : (
        <>
          <div className="audio-visualizer">
            <div 
              className={`volume-indicator ${isSpeaking ? 'speaking' : ''}`} 
              style={{ height: `${Math.min(100, (volume / 255) * 100)}%` }}
            ></div>
          </div>
          
          {deviceInfo && (
            <div className="device-info">
              {deviceInfo}
              {isSpeaking && <span className="speaking-indicator">말하는 중...</span>}
            </div>
          )}
        </>
      )}
      
      <div className="controls">
        <button
          onClick={toggleAudio}
          className={`audio-toggle ${audioActive ? 'active' : 'inactive'}`}
        >
          {audioActive ? '마이크 끄기' : '마이크 켜기'}
        </button>
      </div>
    </div>
  );
}; 