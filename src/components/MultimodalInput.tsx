'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { MultimodalInput as MultimodalInputType, validateMultimodalInput } from '@/lib/api/multimodal';

interface MultimodalInputProps {
  sessionId: string;
  onFileSelect: (input: MultimodalInputType) => void;
  onCancel: () => void;
}

export default function MultimodalInput({ sessionId, onFileSelect, onCancel }: MultimodalInputProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'image' | 'audio'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    // 선택된 파일 타입에 따른 검증
    const inputData: MultimodalInputType = {
      type: inputType,
      file,
      mimeType: file.type,
    };
    
    const validationResult = validateMultimodalInput(inputData);
    
    if (!validationResult.valid) {
      setError(validationResult.error || '유효하지 않은 파일입니다.');
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    
    setSelectedFile(file);
    
    // 이미지인 경우 미리보기 생성
    if (inputType === 'image' && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  // 파일 전송 처리
  const handleSubmit = () => {
    if (!selectedFile) {
      setError('파일을 선택해주세요.');
      return;
    }
    
    const inputData: MultimodalInputType = {
      type: inputType,
      file: selectedFile,
      mimeType: selectedFile.type,
    };
    
    onFileSelect(inputData);
  };

  // 파일 선택기 열기
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">멀티모달 입력</h3>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      {/* 입력 타입 선택 */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setInputType('image')}
          className={`px-4 py-2 rounded ${
            inputType === 'image' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          이미지
        </button>
        <button
          onClick={() => setInputType('audio')}
          className={`px-4 py-2 rounded ${
            inputType === 'audio' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          음성
        </button>
      </div>
      
      {/* 파일 입력 */}
      <div className="mb-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={inputType === 'image' ? 'image/*' : 'audio/*'}
          className="hidden"
        />
        
        <div 
          onClick={openFilePicker}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
        >
          {preview ? (
            inputType === 'image' ? (
              <div className="relative w-full h-48 mb-3">
                <Image
                  src={preview}
                  alt="미리보기"
                  fill
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div className="mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  오디오 파일: {selectedFile?.name}
                </p>
              </div>
            )
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                {inputType === 'image' ? '이미지를 클릭하여 업로드' : '오디오 파일을 클릭하여 업로드'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {inputType === 'image' ? 'JPG, PNG, GIF 지원 (최대 10MB)' : 'MP3, WAV, M4A 지원 (최대 50MB)'}
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* 오류 메시지 */}
      {error && (
        <div className="text-red-500 text-sm mb-3">
          {error}
        </div>
      )}
      
      {/* 버튼 */}
      <div className="flex justify-end space-x-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedFile}
          className={`px-4 py-2 rounded-md ${
            selectedFile 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          전송
        </button>
      </div>
    </div>
  );
} 