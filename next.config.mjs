// Headers on every response. The deal-room file downloads add a stricter policy of their own.
const security = [
  // Nobody may show Gridstock inside a frame on another site (clickjacking on Accept NDA or Accept offer).
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Deal ids are in the address bar; do not hand them to other sites in the Referer header.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
  async headers() {
    // Deal-room documents (/deals/<id>/files/...) set a stricter Content-Security-Policy of their own
    // (default-src 'none'; sandbox), so this one must not replace it there.
    return [{ source: '/((?!deals/[^/]+/files).*)', headers: security },
      { source: '/deals/:id/files/:path*', headers: security.filter(h => h.key !== 'Content-Security-Policy') }];
  },
};
