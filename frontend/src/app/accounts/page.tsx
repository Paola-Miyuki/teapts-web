import { Suspense } from 'react';

import Accounts from './_components/Accounts';

export default function AccountsPage() {
  // O useSearchParams (busca e filtros) exige um limite de Suspense.
  return (
    <Suspense>
      <Accounts />
    </Suspense>
  );
}
