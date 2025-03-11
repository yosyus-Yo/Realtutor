import Prism from 'prismjs';

// 기본 언어 로드
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-markup'; // HTML
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';

// 지원되는 언어 목록
export const supportedLanguages = [
  { name: 'JavaScript', value: 'javascript', alias: ['js'] },
  { name: 'TypeScript', value: 'typescript', alias: ['ts'] },
  { name: 'Python', value: 'python', alias: ['py'] },
  { name: 'Java', value: 'java', alias: [] },
  { name: 'C', value: 'c', alias: [] },
  { name: 'C++', value: 'cpp', alias: ['c++'] },
  { name: 'C#', value: 'csharp', alias: ['c#', 'cs'] },
  { name: 'HTML', value: 'markup', alias: ['html', 'xml'] },
  { name: 'CSS', value: 'css', alias: [] },
  { name: 'JSX', value: 'jsx', alias: ['react'] },
  { name: 'TSX', value: 'tsx', alias: ['react-ts'] },
  { name: 'JSON', value: 'json', alias: [] },
  { name: 'SQL', value: 'sql', alias: [] },
  { name: 'Markdown', value: 'markdown', alias: ['md'] }
];

// 언어 별칭을 정규화된 언어 값으로 변환
export const normalizeLanguage = (lang: string): string => {
  if (!lang) return 'javascript'; // 기본값
  
  const lowerLang = lang.toLowerCase().trim();
  
  // 정확한 값 매칭
  const exactMatch = supportedLanguages.find(l => l.value === lowerLang);
  if (exactMatch) return exactMatch.value;
  
  // 별칭 매칭
  for (const language of supportedLanguages) {
    if (language.alias.includes(lowerLang)) {
      return language.value;
    }
  }
  
  // 매칭되지 않으면 기본값 반환
  return 'javascript';
};

// 코드 하이라이팅
export const highlightCode = (code: string, language = 'javascript'): string => {
  const normalizedLang = normalizeLanguage(language);
  
  try {
    return Prism.highlight(
      code, 
      Prism.languages[normalizedLang] || Prism.languages.javascript, 
      normalizedLang
    );
  } catch (error) {
    console.error('코드 하이라이팅 오류:', error);
    return code; // 오류 발생 시 원본 코드 반환
  }
};

// 메시지에서 코드 블록 추출 (```로 둘러싸인 부분)
export const extractCodeBlocks = (message: string): { codeBlocks: string[], language: string[], text: string } => {
  const codeBlockRegex = /```([a-zA-Z0-9]+)?\s*\n([\s\S]*?)```/g;
  
  const codeBlocks: string[] = [];
  const language: string[] = [];
  let text = message;
  
  let match;
  while ((match = codeBlockRegex.exec(message)) !== null) {
    const lang = match[1] || 'javascript';
    const code = match[2];
    
    codeBlocks.push(code);
    language.push(lang);
    
    // 코드 블록을 플레이스홀더로 교체
    text = text.replace(match[0], `[CODE_BLOCK_${codeBlocks.length - 1}]`);
  }
  
  return { codeBlocks, language, text };
};

// 메시지에 코드 블록 삽입
export const insertCodeBlocks = (
  text: string, 
  codeBlocks: string[], 
  languages: string[]
): string => {
  let result = text;
  
  for (let i = 0; i < codeBlocks.length; i++) {
    const placeholder = `[CODE_BLOCK_${i}]`;
    const codeBlock = `\`\`\`${languages[i]}\n${codeBlocks[i]}\n\`\`\``;
    
    result = result.replace(placeholder, codeBlock);
  }
  
  return result;
};

// 메시지에서 코드 블록 탐지 및 래핑
export const processMessageWithCodeBlocks = (message: string): string => {
  const { codeBlocks, language, text } = extractCodeBlocks(message);
  
  if (codeBlocks.length === 0) {
    return message;
  }
  
  const highlightedBlocks = codeBlocks.map((code, index) => {
    const lang = language[index];
    return highlightCode(code, lang);
  });
  
  // 하이라이트된 코드 블록 삽입 (HTML 형식)
  let result = text;
  for (let i = 0; i < highlightedBlocks.length; i++) {
    const placeholder = `[CODE_BLOCK_${i}]`;
    const lang = language[i];
    const highlightedCode = highlightedBlocks[i];
    
    const codeBlock = `
      <div class="code-block">
        <div class="code-header">
          <span class="language">${lang}</span>
          <button class="copy-button" data-code="${encodeURIComponent(codeBlocks[i])}">복사</button>
        </div>
        <pre class="language-${lang}"><code>${highlightedCode}</code></pre>
      </div>
    `;
    
    result = result.replace(placeholder, codeBlock);
  }
  
  return result;
}; 