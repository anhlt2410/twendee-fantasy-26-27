/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Don't serve stale prefetched pages from the client-side Router Cache.
    // Tabs (Classic / H2H / Achievements) are separate routes; without this a
    // tab switch after "Đồng bộ từ FPL" would re-show the prefetched pre-sync copy.
    // With 0, every navigation revalidates against the server (which the sync
    // action busts via revalidateTag), so all tabs match the latest data.
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
