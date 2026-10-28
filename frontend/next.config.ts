import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera .next/standalone: o servidor mais só os módulos que ele carrega.
  // É o que a imagem de produção copia, em vez do node_modules inteiro.
  output: 'standalone',

  // A home autenticada fica em /home; a raiz só redireciona para ela.
  async redirects() {
    return [{ source: '/', destination: '/home', permanent: false }];
  },
};

export default nextConfig;
