// 로컬 스토리지 키
const KEYS = {
  MULTIMODAL_SESSION: 'realtutor_multimodal_session',
};

/**
 * 멀티모달 세션 정보를 저장
 */
export const saveMultimodalSessionInfo = (data: {
  subject: string;
  level: string;
  goal: string;
}) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEYS.MULTIMODAL_SESSION, JSON.stringify(data));
      return true;
    }
    return false;
  } catch (e) {
    console.error('로컬 스토리지 저장 오류:', e);
    return false;
  }
};

/**
 * 멀티모달 세션 정보를 가져옴
 */
export const getMultimodalSessionInfo = () => {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(KEYS.MULTIMODAL_SESSION);
      if (data) {
        return JSON.parse(data) as {
          subject: string;
          level: string;
          goal: string;
        };
      }
    }
    return null;
  } catch (e) {
    console.error('로컬 스토리지 로드 오류:', e);
    return null;
  }
};

/**
 * 멀티모달 세션 정보를 삭제
 */
export const clearMultimodalSessionInfo = () => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KEYS.MULTIMODAL_SESSION);
      return true;
    }
    return false;
  } catch (e) {
    console.error('로컬 스토리지 삭제 오류:', e);
    return false;
  }
}; 