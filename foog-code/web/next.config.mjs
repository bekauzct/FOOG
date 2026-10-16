/** @type {import('next').NextConfig} */
const API = process.env.API_URL || 'http://localhost:4000';
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Bitta domen: /api/v1 va /uploads API serverga yo‘naltiriladi (cookie bir xil domenda ishlaydi)
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${API}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${API}/uploads/:path*` },
    ];
  },
  experimental: { proxyTimeout: 300000 },
};
export default nextConfig;
