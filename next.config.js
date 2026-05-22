/** @type {import('next').NextConfig} */
const nextConfig = {
  // livekit-server-sdk jest używany tylko w backendzie (Express),
  // nie w Next.js — więc to ustawienie jest zbędne.
  // Zostawiamy puste żeby nie crashował build na Vercel.

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.railway.app' },
      { protocol: 'https', hostname: '*.up.railway.app' },
      { protocol: 'https', hostname: '*.trycloudflare.com' },
      { protocol: 'http',  hostname: 'localhost' },
    ],
  },
}

module.exports = nextConfig
