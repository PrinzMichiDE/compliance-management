import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['@mui/material', '@mui/icons-material', '@mui/x-charts', '@emotion/react', '@emotion/styled'],
};

export default nextConfig;
