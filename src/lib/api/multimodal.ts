/**
 * RealTutor 멀티모달 입력 처리 API
 * 이미지, 음성 등 다양한 형태의 입력을 처리하여 학습 세션에 통합합니다.
 */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { generateResponseWithImage } from './gemini';

// 멀티모달 입력 타입
export type MultimodalInputType = 'image' | 'audio' | 'document' | 'video';

// 멀티모달 입력 데이터 인터페이스
export interface MultimodalInput {
  type: MultimodalInputType;
  file: File;
  description?: string;
  mimeType: string;
}

// 처리된 멀티모달 데이터 인터페이스
export interface ProcessedMultimodalData {
  url: string;
  type: MultimodalInputType;
  mimeType: string;
  extractedContent?: string;
  analysisResult?: any;
}

/**
 * 이미지 파일을 Firebase Storage에 업로드하고 URL을 반환
 */
export const uploadImage = async (
  file: File, 
  sessionId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const timestamp = new Date().getTime();
    const fileExt = file.name.split('.').pop();
    const fileName = `images/${sessionId}/${timestamp}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    
    // 업로드 작업 실행
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    // 업로드 완료까지 대기
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 진행 상황 모니터링 가능
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`업로드 진행률: ${progress.toFixed(2)}%`);
        },
        (error) => {
          // 오류 처리
          console.error('이미지 업로드 오류:', error);
          resolve({ success: false, error: '이미지 업로드에 실패했습니다.' });
        },
        async () => {
          // 업로드 완료 후 다운로드 URL 얻기
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ success: true, url: downloadURL });
          } catch (err) {
            console.error('URL 가져오기 오류:', err);
            resolve({ success: false, error: 'URL을 가져오는 데 실패했습니다.' });
          }
        }
      );
    });
  } catch (error) {
    console.error('이미지 업로드 처리 오류:', error);
    return { success: false, error: '이미지 처리 중 오류가 발생했습니다.' };
  }
};

/**
 * 음성 파일을 Firebase Storage에 업로드하고 URL을 반환
 */
export const uploadAudio = async (
  file: File, 
  sessionId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const timestamp = new Date().getTime();
    const fileExt = file.name.split('.').pop();
    const fileName = `audio/${sessionId}/${timestamp}.${fileExt}`;
    const storageRef = ref(storage, fileName);
    
    // 업로드 작업 실행
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    // 업로드 완료까지 대기
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 진행 상황 모니터링 가능
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`음성 업로드 진행률: ${progress.toFixed(2)}%`);
        },
        (error) => {
          // 오류 처리
          console.error('음성 업로드 오류:', error);
          resolve({ success: false, error: '음성 업로드에 실패했습니다.' });
        },
        async () => {
          // 업로드 완료 후 다운로드 URL 얻기
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ success: true, url: downloadURL });
          } catch (err) {
            console.error('URL 가져오기 오류:', err);
            resolve({ success: false, error: 'URL을 가져오는 데 실패했습니다.' });
          }
        }
      );
    });
  } catch (error) {
    console.error('음성 업로드 처리 오류:', error);
    return { success: false, error: '음성 처리 중 오류가 발생했습니다.' };
  }
};

/**
 * 이미지를 Base64로 변환
 */
export const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      // data:image/jpeg;base64, 부분 제거
      const formattedBase64 = base64.split(',')[1];
      resolve(formattedBase64);
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
};

/**
 * 멀티모달 메시지 처리 및 응답 생성
 */
export const processMultimodalMessage = async (
  sessionId: string,
  subject: string,
  level: string,
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[],
  textMessage: string,
  multimodalInput: MultimodalInput
): Promise<{ success: boolean; text?: string; error?: string }> => {
  try {
    let result;
    
    if (multimodalInput.type === 'image') {
      // 이미지를 Base64로 변환
      const base64Image = await convertImageToBase64(multimodalInput.file);
      
      // Gemini API를 통해 이미지를 포함한 메시지 처리
      result = await generateResponseWithImage(
        subject,
        level,
        messageHistory,
        textMessage,
        base64Image
      );
      
      return {
        success: result.success,
        text: result.text,
        error: result.error
      };
    } else if (multimodalInput.type === 'audio') {
      // 음성 파일은 현재 직접적인 처리 대신 텍스트 메시지와 함께 URL 첨부로 처리
      // 향후 음성-텍스트 변환 API 통합 가능
      return {
        success: false,
        error: '음성 처리 기능은 아직 구현 중입니다.'
      };
    } else {
      return {
        success: false,
        error: '지원하지 않는 멀티모달 입력 유형입니다.'
      };
    }
  } catch (error: any) {
    console.error('멀티모달 메시지 처리 오류:', error);
    return {
      success: false,
      error: error.message || '멀티모달 메시지를 처리하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 멀티모달 입력 검증
 */
export const validateMultimodalInput = (input: MultimodalInput): { valid: boolean; error?: string } => {
  if (!input.file) {
    return { valid: false, error: '파일이 제공되지 않았습니다.' };
  }
  
  // 파일 타입 검증
  if (input.type === 'image') {
    if (!input.file.type.startsWith('image/')) {
      return { valid: false, error: '유효한 이미지 파일이 아닙니다.' };
    }
    
    // 파일 크기 제한 (10MB)
    if (input.file.size > 10 * 1024 * 1024) {
      return { valid: false, error: '이미지 크기는 10MB 이하여야 합니다.' };
    }
  } else if (input.type === 'audio') {
    if (!input.file.type.startsWith('audio/')) {
      return { valid: false, error: '유효한 오디오 파일이 아닙니다.' };
    }
    
    // 파일 크기 제한 (50MB)
    if (input.file.size > 50 * 1024 * 1024) {
      return { valid: false, error: '오디오 크기는 50MB 이하여야 합니다.' };
    }
  }
  
  return { valid: true };
}; 