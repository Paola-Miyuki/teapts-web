import { AppShell } from './AppShell';
import { CreatePts } from './CreatePts';

export const metadata = { title: 'Criar proposta de PTS · TEA-PTS' };

export default function NovoPtsPage() {
  return (
    <AppShell active="createPts">
      <CreatePts />
    </AppShell>
  );
}
