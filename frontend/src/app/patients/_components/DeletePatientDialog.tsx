'use client';

import DeactivateAccountDialog from '@/app/accounts/_components/DeactivateAccountDialog';

type DeletePatientDialogProps = {
  patient: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted: (id: string, name: string) => void;
};

// "Excluir paciente" de `pacientes.html` e `paciente.html` (só admin): é a
// desativação da conta do paciente (RFAUT005, `DELETE /accounts/:id`); o
// perfil segue a situação da conta e o prontuário é mantido.
export default function DeletePatientDialog({
  patient,
  onClose,
  onDeleted,
}: DeletePatientDialogProps) {
  return (
    <DeactivateAccountDialog
      account={patient}
      onClose={onClose}
      onDeactivated={onDeleted}
      title={`Excluir o paciente ${patient?.name ?? ''}?`}
      description="A conta fica inativa e as sessões abertas são encerradas. O prontuário do paciente é mantido."
      confirmLabel="Excluir paciente"
      confirmingLabel="Excluindo..."
      errorMessage="Não foi possível excluir o paciente"
      icon="trash"
    />
  );
}
