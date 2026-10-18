import type { NextConfig } from 'next';
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/\/+$/, '');
const config: NextConfig = { basePath, output: 'export', webpack(config) { config.cache = false; return config; }, images: { unoptimized: true }, trailingSlash: true };
export default config;
