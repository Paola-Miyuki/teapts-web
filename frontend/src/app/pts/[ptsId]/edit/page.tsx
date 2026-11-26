import EditPtsClient from './EditPtsClient';

export const metadata = {
  title: 'Editar PTS · TEA-PTS',
};

export default async function EditPtsPage({
  params,
}: {
  params: Promise<{ ptsId: string }>;
}) {
  const { ptsId } = await params;

  return <EditPtsClient ptsId={ptsId} />;
}
