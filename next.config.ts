import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@mui/material', '@mui/icons-material', '@mui/x-charts', '@emotion/react', '@emotion/styled'],
  // experimental: { // Entferne oder kommentiere den gesamten experimental Block, wenn nicht mehr benötigt
  //   serverComponentsExternalPackages: ['pdf-parse'], 
  // },
  serverExternalPackages: ['pdf-parse'], // Korrigierter Schlüssel
};

export default nextConfig;
