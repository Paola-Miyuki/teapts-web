'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import HomeContent from './HomeContent';

export default function Home() {
  return (
    <AuthenticatedPage currentHref="/home">
      {(account, kind) => (
        <HomeContent account={account} kind={kind} name={account.name} />
      )}
    </AuthenticatedPage>
  );
}
