'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import CreatePts from './CreatePts'; // Importação default (sem as chaves)

export default function NovoPtsClient() {
  return (
   <AuthenticatedPage
  currentHref="/pts/novo"
  breadcrumb="Criar proposta de PTS"
>
  <CreatePts />
</AuthenticatedPage>
  );
}