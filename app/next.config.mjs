/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pg 是 Node 原生模块，确保只在 server 端打包（Next 14 用 experimental 键）
  experimental: {
    serverComponentsExternalPackages: ["pg"],
  },
};

export default nextConfig;
