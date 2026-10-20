import { CreatePts } from './pts/novo/CreatePts';

export const metadata = { title: 'Criar proposta de PTS · TEA-PTS' };

export default function NovoPtsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex items-center justify-center p-4 md:p-8 lg:p-12">
      <CreatePts />
    </div>
  );
}
