import EditPtsProposalClient from './EditPtsProposalClient';

export const metadata = {
  title: 'Editar proposta de PTS · TEA-PTS',
};

type EditPtsProposalPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPtsProposalPage({
  params,
}: EditPtsProposalPageProps) {
  const { id } = await params;

  return <EditPtsProposalClient proposalId={id} />;
}
