import Link from 'next/link';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

// Bloqueio das telas de pacientes para quem não é admin.
export default function AdminOnly({ message }: { message: string }) {
  return (
    <div className={ui.empty}>
      <div className={ui.emptyIcon}>
        <Icon name="lock" />
      </div>

      <h2>Acesso restrito ao administrador</h2>

      <p>{message}</p>

      <Link href="/home" className={`${ui.btn} ${ui.btnSecondary}`}>
        Voltar para o início
      </Link>
    </div>
  );
}
