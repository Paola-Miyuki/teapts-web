import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera .next/standalone: o servidor mais só os módulos que ele carrega.
  // É o que a imagem de produção copia, em vez do node_modules inteiro.
  output: 'standalone',
};

export default nextConfig;
