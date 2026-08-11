/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        // Group chat image/video attachments are served by the backend's static /uploads
        // route (see backend/src/middleware/upload.js) and referenced by group messages as
        // relative URLs like /uploads/group-attachments/xyz.png. In production nginx proxies
        // /uploads/ straight to the backend (see nginx.conf); this mirrors that for local
        // `next dev` so a plain relative <img src="/uploads/..."> resolves the same way.
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
