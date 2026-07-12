/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No CSP here deliberately: this app has no rich-text/HTML rendering path
  // (see sanitize-html usage on the API side), so a CSP would be defense
  // added without a corresponding gap it closes, and getting one right for
  // Next's inline hydration scripts without breaking the app needs its own
  // testing pass. These headers are the ones with no such tradeoff.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
