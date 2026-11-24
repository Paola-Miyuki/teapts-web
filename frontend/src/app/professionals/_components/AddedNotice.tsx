'use client';

import { useSearchParams } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

// Aviso depois de "Adicionar profissional" (`/professionals?added=1`).
export default function AddedNotice() {
  const added = useSearchParams().get('added') === '1';

  if (!added) {
    return null;
  }

  return (
    <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
      <div className={ui.alertIcon}>
        <Icon name="checkCircle" />
      </div>
      <span>Profissional adicionado.</span>
    </div>
  );
}
