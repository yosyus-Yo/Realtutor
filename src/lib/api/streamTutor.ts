/**
 * RealTutor 실시간 스트리밍 튜터 API
 * Google AI Studio의 Stream Realtime 기능을 활용한 실시간 튜터링 기능을 제공합니다.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from '@google/generative-ai';

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

/**
 * 메시지 히스토리를 Gemini API 형식으로 변환
 */
const convertToGeminiHistory = (
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[]
): Content[] => {
  return messageHistory.map(msg => ({
    role: msg.role === 'tutor' ? 'model' : msg.role,
    parts: [{ text: msg.content }],
  }));
};

/**
 * 튜터링 세션에 대한 프롬프트 생성
 */
const createTutorSystemPrompt = (subject: string, level: string): string => {
  return `당신은 ${subject}를 가르치는 전문 교육자입니다. 학생의 수준은 ${level}입니다.
학생들이 질문하면 명확하고 이해하기 쉬운 방식으로 대답해주세요.
답변은 단계별로 제공하고, 필요한 경우 예시를 들어 설명하세요.
학생의 오해나 잘못된 개념에 대해 정중하게 수정해주세요.
학생이 질문에 어려움을 겪는다면, 소크라테스식 질문법을 사용하여 스스로 답을 찾도록 도와주세요.
어려운 주제는 더 쉬운 부분으로 나누어 설명하세요.
정확한 정보만 제공하고, 확실하지 않은 내용은 솔직하게 모른다고 말하세요.
설명 중에는 간단한 그림, 다이어그램, 수식을 텍스트로 표현할 수 있습니다.
한국어로 응답해주세요.`;
};

/**
 * 실시간 스트리밍 튜터 세션 생성
 */
export const createStreamingTutorSession = async (
  subject: string,
  level: string,
  initialPrompt?: string
): Promise<RTCPeerConnection> => {
  try {
    // WebRTC 연결 설정
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // 데이터 채널 생성
    const dataChannel = peerConnection.createDataChannel('tutor-session', {
      ordered: true,
    });
    
    // 데이터 채널 이벤트 설정
    setupDataChannel(dataChannel, subject, level, initialPrompt);
    
    // 연결 협상 시작
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    // SDP에 setup=actpass 설정
    offer.sdp = setSdpSetupAttribute(offer.sdp || '', 'actpass');
    
    await peerConnection.setLocalDescription(offer);
    
    // 자체 응답 생성 및 설정 (로컬 테스트용)
    const answer = await createSelfAnswer(offer);
    
    // SDP에 setup=active 설정
    answer.sdp = setSdpSetupAttribute(answer.sdp || '', 'active');
    
    // 약간의 지연 후 원격 설명 설정 (연결 안정성 향상)
    await new Promise(resolve => setTimeout(resolve, 500));
    await peerConnection.setRemoteDescription(answer);
    
    return peerConnection;
  } catch (error) {
    console.error('스트리밍 튜터 세션 생성 오류:', error);
    throw error;
  }
};

/**
 * SDP의 setup 속성을 설정하는 함수
 * @param sdp SDP 문자열
 * @param setupValue setup 속성값 ('active', 'passive', 'actpass' 중 하나)
 * @returns 수정된 SDP 문자열
 */
const setSdpSetupAttribute = (sdp: string, setupValue: 'active' | 'passive' | 'actpass' = 'actpass'): string => {
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
};

/**
 * 자체 응답 생성 (로컬 테스트용)
 */
const createSelfAnswer = async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
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
};

/**
 * 데이터 채널 설정
 */
const setupDataChannel = (
  dataChannel: RTCDataChannel,
  subject: string,
  level: string,
  initialPrompt?: string
): void => {
  // 메시지 히스토리
  const messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[] = [];
  
  // 채널 열림 이벤트
  dataChannel.onopen = async () => {
    console.log('튜터 세션 데이터 채널이 열렸습니다.');
    
    // 초기 시스템 프롬프트 설정
    const systemPrompt = createTutorSystemPrompt(subject, level);
    
    if (initialPrompt) {
      // 초기 메시지 전송
      const message = {
        type: 'begin-session',
        systemPrompt,
        initialPrompt,
      };
      
      dataChannel.send(JSON.stringify(message));
      
      // 히스토리에 초기 메시지 추가
      messageHistory.push({ role: 'user', content: initialPrompt });
      
      // 초기 응답 생성 및 스트리밍
      await streamTutorResponse(dataChannel, systemPrompt, messageHistory);
    } else {
      // 시스템 프롬프트만 전송
      const message = {
        type: 'begin-session',
        systemPrompt,
      };
      
      dataChannel.send(JSON.stringify(message));
    }
  };
  
  // 메시지 수신 이벤트
  dataChannel.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'user-message') {
        const userMessage = message.content;
        
        // 사용자 메시지를 히스토리에 추가
        messageHistory.push({ role: 'user', content: userMessage });
        
        // 응답 생성 및 스트리밍
        await streamTutorResponse(dataChannel, createTutorSystemPrompt(subject, level), messageHistory);
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      
      dataChannel.send(JSON.stringify({
        type: 'error',
        content: '메시지 처리 중 오류가 발생했습니다.'
      }));
    }
  };
  
  // 채널 닫힘 이벤트
  dataChannel.onclose = () => {
    console.log('튜터 세션 데이터 채널이 닫혔습니다.');
  };
  
  // 채널 오류 이벤트
  dataChannel.onerror = (error) => {
    console.error('튜터 세션 데이터 채널 오류:', error);
  };
};

/**
 * 튜터 응답을 실시간으로 스트리밍
 */
const streamTutorResponse = async (
  dataChannel: RTCDataChannel,
  systemPrompt: string,
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[]
): Promise<void> => {
  try {
    // Gemini 모델 가져오기
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
    
    // 대화 히스토리 준비 (시스템 프롬프트는 별도로 처리)
    const history = messageHistory.slice(0, -1).map(msg => ({
      role: msg.role === 'tutor' ? 'model' : msg.role,
      content: msg.content
    }));
    
    // 대화 히스토리가 비어있거나 첫 메시지가 'user'가 아닌 경우 처리
    let geminiHistory: Content[] = [];
    
    // 대화 히스토리가 비어있지 않은 경우에만 변환
    if (history.length > 0) {
      // 첫 번째 메시지가 user가 아니면 빈 히스토리로 시작
      if (history[0].role !== 'user') {
        geminiHistory = [];
      } else {
        // Gemini API에 맞게 변환 (첫 번째는 user 메시지여야 함)
        geminiHistory = history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));
      }
    }
    
    // 채팅 세션 생성
    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
    
    // 응답 시작 메시지 전송
    dataChannel.send(JSON.stringify({
      type: 'response-start',
    }));
    
    // 마지막 메시지로 응답 생성 및 스트리밍
    const lastMessage = messageHistory[messageHistory.length - 1].content;
    
    // 시스템 프롬프트를 사용자 메시지에 포함시킴
    const messageWithSystemPrompt = `${systemPrompt}\n\n${lastMessage}`;
    
    const result = await chat.sendMessageStream(messageWithSystemPrompt);
    
    let fullResponse = '';
    
    // 응답 스트리밍
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // 청크 전송
      dataChannel.send(JSON.stringify({
        type: 'response-chunk',
        content: chunkText,
      }));
    }
    
    // 응답 종료 메시지 전송
    dataChannel.send(JSON.stringify({
      type: 'response-end',
      content: fullResponse,
    }));
    
    // 히스토리에 튜터 응답 추가
    messageHistory.push({ role: 'tutor', content: fullResponse });
    
  } catch (error) {
    console.error('튜터 응답 스트리밍 오류:', error);
    
    // 오류 메시지 전송
    dataChannel.send(JSON.stringify({
      type: 'error',
      content: '튜터 응답을 생성하는 중 오류가 발생했습니다.'
    }));
  }
};

/**
 * 이미지 기반 실시간 튜터링 (멀티모달)
 */
export const streamMultimodalTutoring = async (
  dataChannel: RTCDataChannel,
  subject: string,
  level: string,
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[],
  userMessage: string,
  imageData: string // Base64 인코딩된 이미지
): Promise<void> => {
  try {
    // Gemini 모델 가져오기 (멀티모달 지원 모델)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      safetySettings,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
    
    // 시스템 프롬프트
    const systemPrompt = createTutorSystemPrompt(subject, level) + 
      "\n\n학습자가 이미지를 공유했습니다. 이미지의 내용을 분석하고 학습 목표에 맞게 도움을 제공하세요.";
    
    // 대화 히스토리 준비 (시스템 프롬프트는 별도로 처리)
    const history = messageHistory.map(msg => ({
      role: msg.role === 'tutor' ? 'model' : msg.role,
      content: msg.content
    }));
    
    // 대화 히스토리가 비어있거나 첫 메시지가 'user'가 아닌 경우 처리
    let geminiHistory: Content[] = [];
    
    // 대화 히스토리가 비어있지 않은 경우에만 변환
    if (history.length > 0) {
      // 첫 번째 메시지가 user가 아니면 빈 히스토리로 시작
      if (history[0].role !== 'user') {
        geminiHistory = [];
      } else {
        // Gemini API에 맞게 변환 (첫 번째는 user 메시지여야 함)
        geminiHistory = history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        }));
      }
    }
    
    // 응답 시작 메시지 전송
    dataChannel.send(JSON.stringify({
      type: 'response-start',
    }));
    
    // 채팅 세션 생성 및 응답 스트리밍
    const chat = model.startChat({
      history: geminiHistory,
    });
    
    // 시스템 프롬프트와 사용자 메시지를 포함한 요청 전송
    const imageParts = [
      { text: systemPrompt + "\n\n" + userMessage },
      {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg'
        }
      }
    ];
    
    const result = await chat.sendMessageStream(imageParts);
    
    let fullResponse = '';
    
    // 응답 스트리밍
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // 청크 전송
      dataChannel.send(JSON.stringify({
        type: 'response-chunk',
        content: chunkText,
      }));
    }
    
    // 응답 종료 메시지 전송
    dataChannel.send(JSON.stringify({
      type: 'response-end',
      content: fullResponse,
    }));
    
    // 히스토리에 사용자 메시지와 튜터 응답 추가
    messageHistory.push({ role: 'user', content: userMessage + ' [이미지 첨부]' });
    messageHistory.push({ role: 'tutor', content: fullResponse });
    
  } catch (error) {
    console.error('멀티모달 튜터링 오류:', error);
    
    // 오류 메시지 전송
    dataChannel.send(JSON.stringify({
      type: 'error',
      content: '멀티모달 튜터 응답을 생성하는 중 오류가 발생했습니다.'
    }));
  }
}; 