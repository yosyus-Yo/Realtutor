import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from '@google/generative-ai';

// API 키는 환경 변수로 관리
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyATE98C8V0H5MyjagyYg9vlqDxjdsVsAgQ';

// 환경 변수가 없는 경우 경고
if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  console.warn('NEXT_PUBLIC_GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. 기본 키를 사용합니다.');
}

// Gemini API 인스턴스 생성
const genAI = new GoogleGenerativeAI(API_KEY);

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

// 생성 구성
const generationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};

// 튜터링 시스템 프롬프트
const TUTOR_SYSTEM_PROMPT = `당신은 RealTutor라는 개인화된 AI 학습 튜터입니다. 
당신의 역할은 학생들이 다양한 주제에 대해 더 깊이 이해하도록 돕는 것입니다.

다음 원칙을 따라주세요:
1. 소크라테스식 방법을 사용하여 학생이 스스로 생각하고 답을 찾아가도록 도와주세요.
2. 학생의 현재 이해 수준에 맞춰 설명하되, 조금씩 더 높은 수준으로 안내해주세요.
3. 단순히 답을 제공하기보다는 학생이 개념을 이해할 수 있도록 도와주세요.
4. 친절하고 격려하는 태도를 유지하되, 필요할 때는 정확한 피드백을 제공하세요.
5. 학생의 질문이나 참여를 유도하는 질문으로 대화를 계속 이어가세요.

학습 영역에 따라 적절한 방식으로 안내해주세요:
- 수학: 문제 해결 과정을 단계별로 안내하고, 시각적 설명을 활용하세요.
- 프로그래밍: 코드 예시와 함께 개념을 설명하고, 실제 응용 사례를 제시하세요.
- 과학: 실험과 관찰을 통한 이해를 돕고, 일상생활과 연결시키세요.
- 언어: 문법 규칙보다는 언어의 활용과 맥락에 중점을 두세요.
- 역사: 사건의 인과관계와 다양한 관점을 제시하세요.
- 예술: 창의적 표현과 작품 해석에 초점을 맞추세요.

학생의 수준에 맞게 응답하세요:
- 초급: 기본 개념을 쉽게 설명하고 구체적인 예시를 제공하세요.
- 중급: 개념 간의 연결성을 강조하고 더 복잡한 문제에 적용해보세요.
- 고급: 심층적인 분석과 비판적 사고를 장려하고 실제 사례에 적용해보세요.`;

// 메시지 히스토리 형식을 Gemini API 형식으로 변환
const convertToGeminiHistory = (messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[]): Content[] => {
  return messageHistory.map(msg => ({
    role: msg.role === 'tutor' ? 'model' : msg.role,
    parts: [{ text: msg.content }]
  }));
};

/**
 * Gemini Pro 모델 초기화
 */
export const getGeminiProModel = () => {
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    safetySettings,
    generationConfig,
  });
};

/**
 * Gemini Flash 모델 초기화 (더 빠른 응답이 필요할 때)
 */
export const getGeminiFlashModel = () => {
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    safetySettings,
    generationConfig,
  });
};

/**
 * 튜터링 세션 시작 (첫 응답 생성)
 */
export const startTutoringSession = async (
  subject: string,
  level: string,
  goal: string
) => {
  try {
    const model = getGeminiProModel();
    const prompt = `${TUTOR_SYSTEM_PROMPT}

학습 주제: ${subject}
학습자 수준: ${level}
학습 목표: ${goal}

첫 인사와 함께 학습을 시작하고, 학습자의 현재 이해도를 파악하기 위한 질문을 해주세요.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return {
      success: true,
      text: response.text(),
    };
  } catch (error: any) {
    console.error('튜터링 세션 시작 오류:', error);
    return {
      success: false,
      error: error.message || '튜터링 세션을 시작하는 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 채팅 메시지에 대한 응답 생성
 */
export const generateTutorResponse = async (
  subject: string,
  level: string,
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[],
  lastMessage: string
) => {
  try {
    const model = getGeminiProModel();
    
    // 시스템 프롬프트 생성
    const systemPrompt = `${TUTOR_SYSTEM_PROMPT}
      
학습 주제: ${subject}
학습자 수준: ${level}`;
    
    // 첫 번째 사용자 메시지와 시스템 프롬프트 결합
    // (대화가 비어있거나 첫 메시지가 사용자의 것이 아닐 경우)
    if (messageHistory.length === 0) {
      // 메시지가 없는 경우 현재 메시지만으로 응답
      return generateSingleResponse(subject, level, lastMessage);
    }
    
    // Gemini 채팅 API는 첫 번째 메시지가 반드시 'user' 역할이어야 함
    let geminiHistory: Content[] = [];
    let startIdx = 0;
    
    // 첫 번째 user 메시지 찾기
    for (let i = 0; i < messageHistory.length; i++) {
      if (messageHistory[i].role === 'user') {
        startIdx = i;
        break;
      }
    }
    
    // 대화 히스토리 구성 - 첫 번째 user 메시지부터 시작
    if (startIdx < messageHistory.length) {
      for (let i = startIdx; i < messageHistory.length; i++) {
        const msg = messageHistory[i];
        geminiHistory.push({
          role: msg.role === 'tutor' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    } else {
      // 사용자 메시지가 없는 경우 단일 응답 생성으로 폴백
      return generateSingleResponse(subject, level, lastMessage);
    }
    
    // 대화 시작
    const chat = model.startChat({
      history: geminiHistory,
    });
    
    // 시스템 프롬프트를 prefix로 추가하여 전송
    // (마지막 메시지가 아닌 경우에는 시스템 프롬프트 생략)
    const result = await chat.sendMessage(`
이전 대화를 바탕으로 계속 답변해주세요. 당신은 RealTutor 튜터입니다.
학습 주제는 ${subject}이고, 학습자 수준은 ${level}입니다.

사용자 질문: ${lastMessage}
`);
    
    return {
      success: true,
      text: result.response.text(),
    };
  } catch (error: any) {
    console.error('튜터 응답 생성 오류:', error);
    return {
      success: false,
      error: error.message || '튜터 응답을 생성하는 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 단일 메시지에 대한 응답 생성 (대화 히스토리 없음)
 */
const generateSingleResponse = async (subject: string, level: string, message: string) => {
  try {
    const model = getGeminiProModel();
    
    const prompt = `${TUTOR_SYSTEM_PROMPT}

학습 주제: ${subject}
학습자 수준: ${level}

학습자 질문: ${message}

학습자의 질문에 답변해주세요. 자세하고 도움이 되는 방식으로 응답하세요.`;

    const result = await model.generateContent(prompt);
    return {
      success: true,
      text: result.response.text(),
    };
  } catch (error: any) {
    console.error('단일 응답 생성 오류:', error);
    return {
      success: false,
      error: error.message || '튜터 응답을 생성하는 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 이미지와 함께 질문에 대한 응답 생성
 */
export const generateResponseWithImage = async (
  subject: string,
  level: string,
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[],
  lastMessage: string,
  imageData: string // Base64 인코딩된 이미지
) => {
  try {
    const model = getGeminiProModel();
    
    // 먼저 이미지와 함께 단일 쿼리로 처리
    const prompt = `${TUTOR_SYSTEM_PROMPT}

학습 주제: ${subject}
학습자 수준: ${level}

학습자가 보낸 이미지와 함께 다음 질문에 답변해주세요: ${lastMessage}

가능한 한 자세히 이미지를 분석하고 관련된 학습 내용을 설명해주세요.`;

    // 이미지 데이터 준비
    const imageParts = [
      {
        inlineData: {
          data: imageData,
          mimeType: "image/jpeg"
        }
      },
      {
        text: prompt
      }
    ];

    // 이미지와 함께 응답 생성
    const result = await model.generateContent(imageParts);
    
    return {
      success: true,
      text: result.response.text(),
    };
  } catch (error: any) {
    console.error('이미지 응답 생성 오류:', error);
    return {
      success: false,
      error: error.message || '이미지를 처리하는 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 학습 요약 생성
 */
export const generateSessionSummary = async (
  subject: string,
  messageHistory: { role: 'user' | 'model' | 'tutor'; content: string }[]
) => {
  try {
    const model = getGeminiFlashModel();
    
    // 대화 내용을 하나의 텍스트로 결합
    const conversationText = messageHistory
      .map(msg => `${msg.role === 'user' ? '학생' : '튜터'}: ${msg.content}`)
      .join('\n\n');
    
    const prompt = `다음은 "${subject}" 주제에 대한 튜터링 세션의 대화 내용입니다:

${conversationText}

이 학습 세션의 요약을 작성해주세요. 다음 사항을 포함하세요:
1. 다룬 주요 개념들
2. 학생이 잘 이해한 부분
3. 더 학습이 필요한 부분
4. 다음 학습을 위한 제안사항

요약은 간결하고 명확하게 작성해주세요.`;

    const result = await model.generateContent(prompt);
    return {
      success: true,
      text: result.response.text(),
    };
  } catch (error: any) {
    console.error('세션 요약 생성 오류:', error);
    return {
      success: false,
      error: error.message || '학습 세션 요약을 생성하는 중 오류가 발생했습니다.',
    };
  }
};

// 추천 학습 자료 생성
export const generateLearningResources = async (
  subject: string,
  level: string,
  interests: string[],
  recentTopics: string[]
) => {
  try {
    const model = getGeminiFlashModel();
    
    const interestsText = interests.length > 0 
      ? `관심 영역: ${interests.join(', ')}` 
      : '';
    
    const recentTopicsText = recentTopics.length > 0 
      ? `최근 학습 주제: ${recentTopics.join(', ')}` 
      : '';
    
    const prompt = `학습자를 위한 맞춤형 학습 자료를 추천해주세요.

학습 주제: ${subject}
학습자 수준: ${level}
${interestsText}
${recentTopicsText}

다음 형식으로 5개의 추천 자료를 제공해주세요:
1. 자료 제목
   - 유형: (책, 온라인 강의, 비디오, 웹사이트, 연습 문제 등)
   - 난이도: (초급/중급/고급)
   - 설명: (이 자료가 학습자에게 어떻게 도움이 되는지 간단히 설명)
   - 링크: (가능한 경우)`;

    const result = await model.generateContent(prompt);
    return {
      success: true,
      text: result.response.text(),
    };
  } catch (error: any) {
    console.error('학습 자료 추천 오류:', error);
    return {
      success: false,
      error: error.message || '학습 자료 추천을 생성하는 중 오류가 발생했습니다.',
    };
  }
};

/**
 * 학습 경로 생성
 */
export const generateLearningPath = async (
  subject: string,
  level: string,
  interests: string[] = []
) => {
  try {
    const model = getGeminiProModel();
    
    const prompt = `당신은 개인화된 학습 경로를 생성하는 교육 전문가입니다.
다음 정보를 바탕으로 단계별 학습 경로를 생성해주세요:

주제: ${subject}
학습자 수준: ${level}
관심 분야: ${interests.join(', ')}

단계는 총 5개만 생성해 주세요. 각 단계에는 2개의 학습 자료를 포함하세요.
너무 긴 응답은 처리할 수 없으니 내용을 간결하게 유지해주세요.

학습 경로는 다음 형식의 JSON으로만 제공해주세요:
{
  "title": "학습 경로 제목 (50자 이내)",
  "description": "학습 경로에 대한 간략한 설명 (100자 이내)",
  "steps": [
    {
      "id": "step1",
      "title": "단계 1 제목 (30자 이내)",
      "description": "단계 1에 대한 설명 (50자 이내)",
      "order": 1,
      "isCompleted": false,
      "resources": [
        {
          "id": "resource1",
          "title": "자료 제목 (30자 이내)",
          "type": "article",
          "description": "자료에 대한 설명 (50자 이내)"
        }
      ]
    }
  ]
}

제약 사항:
1. 단계는 정확히 5개만 생성
2. 각 단계는 정확히 2개의 resources 포함
3. 모든 설명은 간결하게 작성
4. type 값은 "article", "video", "exercise", "quiz", "book", "other" 중 하나만 사용
5. URL은 필요 없음 (포함하지 마세요)
6. 반드시 유효한 JSON만 생성 (설명 텍스트 없이)`;

    // 응답 생성 시 최대 토큰 제한 설정
    const customGenerationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,  // 출력 토큰 수 확대
    };

    const model2 = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      safetySettings,
      generationConfig: customGenerationConfig,
    });

    // 토큰 제한을 높여 응답 생성
    const result = await model2.generateContent(prompt);
    const response = result.response.text();
    
    console.log('Gemini 응답 (처음 100자):', response.substring(0, 100) + '...');
    
    try {
      // 첫 번째 시도: 전체 텍스트가 JSON인 경우
      try {
        const trimmedResponse = response.trim();
        const directParse = JSON.parse(trimmedResponse);
        console.log('직접 JSON 파싱 성공');
        return {
          success: true,
          path: directParse
        };
      } catch (directParseError) {
        console.log('직접 파싱 실패, 다른 방법 시도');
      }
      
      // 두 번째 시도: 코드 블록에서 JSON 추출
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
      const codeBlockMatch = response.match(codeBlockRegex);
      
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          const jsonFromCodeBlock = JSON.parse(codeBlockMatch[1].trim());
          console.log('코드 블록에서 JSON 파싱 성공');
          return {
            success: true,
            path: jsonFromCodeBlock
          };
        } catch (codeBlockParseError) {
          console.log('코드 블록 파싱 실패');
        }
      }
      
      // 세 번째 시도: JSON 블록 찾기
      const jsonRegex = /{[\s\S]*}/;
      const jsonMatch = response.match(jsonRegex);
      
      if (jsonMatch && jsonMatch[0]) {
        try {
          const jsonFromRegex = JSON.parse(jsonMatch[0]);
          console.log('정규식 파싱 성공');
          return {
            success: true,
            path: jsonFromRegex
          };
        } catch (regexParseError) {
          console.log('정규식 파싱 실패');
        }
      }
      
      // 네 번째 시도: 중괄호 찾기
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonString = response.substring(jsonStart, jsonEnd);
        try {
          const path = JSON.parse(jsonString);
          console.log('중괄호 파싱 성공');
          return {
            success: true,
            path
          };
        } catch (bracketParseError) {
          console.log('중괄호 파싱 실패');
        }
      }
      
      // 모든 파싱 시도 실패
      console.error('응답을 JSON으로 파싱할 수 없습니다. 전체 응답:', response);
      throw new Error('유효한 JSON을 찾을 수 없습니다');
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      
      // 백업 학습 경로 생성
      console.log('백업 학습 경로 생성');
      const fallbackPath = createFallbackLearningPath(subject, level);
      return {
        success: true,
        path: fallbackPath
      };
    }
  } catch (error: any) {
    console.error('학습 경로 생성 오류:', error);
    return {
      success: false,
      error: error.message || '학습 경로를 생성하는 중 오류가 발생했습니다.'
    };
  }
};

/**
 * 백업 학습 경로 생성 (API 실패 시 사용)
 */
function createFallbackLearningPath(subject: string, level: string) {
  // 단계 수준 결정
  let stepCount = 5;
  let levelText = '기초';
  
  if (level === 'intermediate') {
    stepCount = 7;
    levelText = '중급';
  } else if (level === 'advanced') {
    stepCount = 9;
    levelText = '고급';
  }
  
  // 기본 경로 생성
  const path = {
    title: `${subject} ${levelText} 학습 경로`,
    description: `${subject}에 대한 체계적인 ${levelText} 수준의 학습 경로입니다.`,
    steps: [] as any[]
  };
  
  // 단계 생성
  for (let i = 1; i <= stepCount; i++) {
    const step = {
      id: `step${i}`,
      title: `${subject} 학습 단계 ${i}`,
      description: `${subject}의 ${i}번째 학습 단계입니다.`,
      order: i,
      isCompleted: false,
      resources: [
        {
          id: `resource${i}_1`,
          title: `${subject} 학습 자료 ${i}-1`,
          type: 'article',
          url: '',
          description: '추천 학습 자료입니다.'
        },
        {
          id: `resource${i}_2`,
          title: `${subject} 학습 자료 ${i}-2`,
          type: 'video',
          url: '',
          description: '추천 학습 영상입니다.'
        }
      ]
    };
    
    path.steps.push(step);
  }
  
  return path;
} 