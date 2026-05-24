/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mapbox GL JS uses Web Workers; Next.js handles this fine, but we
  // expose the public token only via NEXT_PUBLIC_* env so it's bundled
  // correctly on the client.
  env: {
    NEXT_PUBLIC_APP_NAME: 'BoatBuddy',
  },
};

export default nextConfig;
