import { Suspense } from 'react';

import Patients from './_components/Patients';

export default function PatientsPage() {
  // O useSearchParams (termo da busca) exige um limite de Suspense.
  return (
    <Suspense>
      <Patients />
    </Suspense>
  );
}
