import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'hosea-requisitionary-unawares.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.trycloudflare.com',
    '*.loca.lt'
  ],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/api/:path*',
        },
        // Socket.io polling base path (no trailing segment — initial handshake)
        {
          source: '/socket.io',
          destination: 'http://localhost:8000/socket.io',
        },
        // Socket.io with sub-path (session upgrade, etc.)
        {
          source: '/socket.io/:path*',
          destination: 'http://localhost:8000/socket.io/:path*',
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'ngrok-skip-browser-warning',
            value: 'true',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
