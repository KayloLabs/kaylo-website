import type { NextConfig } from 'next';
const config: NextConfig = { output: 'export', webpack(config) { config.cache = false; return config; }, images: { unoptimized: true }, trailingSlash: true };
export default config;
