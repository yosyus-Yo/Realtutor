'use client';

import { useState, useEffect } from 'react';
import { highlightCode, normalizeLanguage } from '@/lib/utils/code';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState('');
  const normalizedLang = normalizeLanguage(language);
  
  // 코드 하이라이팅
  useEffect(() => {
    setHighlightedCode(highlightCode(code, normalizedLang));
  }, [code, normalizedLang]);
  
  // 클립보드에 코드 복사
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('클립보드 복사 실패:', err);
      });
  };
  
  return (
    <div className="code-block">
      <div className="code-header">
        <span className="language">{normalizedLang}</span>
        <button 
          className="copy-button"
          onClick={copyToClipboard}
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre className={`language-${normalizedLang}`}>
        <code 
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
          className={`language-${normalizedLang}`}
        />
      </pre>
    </div>
  );
}

interface ParsedContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

export function parseCodeBlocks(content: string): ParsedContent[] {
  const codeBlockRegex = /```([a-zA-Z0-9]+)?\s*\n([\s\S]*?)```/g;
  const result: ParsedContent[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 코드 블록 이전의 텍스트 추가
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }
    
    // 코드 블록 추가
    const lang = match[1] || 'javascript';
    const code = match[2];
    
    result.push({
      type: 'code',
      content: code,
      language: lang
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // 마지막 코드 블록 이후의 텍스트 추가
  if (lastIndex < content.length) {
    result.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }
  
  return result;
}

// 마크다운 메시지에서 코드 블록 렌더링
export function MessageWithCode({ content }: { content: string }) {
  const parsedContent = parseCodeBlocks(content);
  
  return (
    <div className="message-content">
      {parsedContent.map((block, index) => (
        <div key={index}>
          {block.type === 'text' ? (
            <div className="whitespace-pre-wrap">{block.content}</div>
          ) : (
            <CodeBlock code={block.content} language={block.language} />
          )}
        </div>
      ))}
    </div>
  );
} 