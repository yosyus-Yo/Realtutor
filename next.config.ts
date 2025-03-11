import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      'lh3.googleusercontent.com',       // Google 프로필 이미지
      'firebasestorage.googleapis.com',  // Firebase 스토리지 이미지
      'storage.googleapis.com'           // Firebase 스토리지 대체 도메인
    ],
  },
};

export default nextConfig;
