/** @type {import('next').NextConfig} */
const nextConfig = {
  // livekit-server-sdk jest używany tylko w backendzie (Express),
  // nie w Next.js — więc to ustawienie jest zbędne.
  // Zostawiamy puste żeby nie crashował build na Vercel.

  images: {
    // Zezwól na ładowanie obrazów (avatary) z backendu Railway i lokala
    remotePatterns: [
      { protocol: 'https', hostname: '*.railway.app' },
      { protocol: 'https', hostname: '*.up.railway.app' },
      { protocol: 'http',  hostname: 'localhost' },
      // AlexHost VPS — dodaj swoje IP/domenę po uruchomieniu
      // { protocol: 'https', hostname: 'twoja-domena.pl' },
    ],
  },
}

module.exports = nextConfig
