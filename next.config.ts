import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading the dev server from other devices on the LAN (e.g. a phone).
  // Without this, Next.js blocks cross-origin dev assets/HMR, so the page
  // renders but never hydrates — interactive handlers (login form) don't work.
  allowedDevOrigins: ["192.168.68.126"],
};

export default nextConfig;
