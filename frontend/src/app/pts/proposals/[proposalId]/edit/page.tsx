import EditPtsProposalClient from './EditPtsProposalClient';

export const metadata = {
  title: 'Editar proposta de PTS · TEA-PTS',
};

type EditPtsProposalPageProps = {
  params: Promise<{
    proposalId: string;
  }>;
};

export default async function EditPtsProposalPage({
  params,
}: EditPtsProposalPageProps) {
  const { proposalId } = await params;

  return <EditPtsProposalClient proposalId={proposalId} />;
}
