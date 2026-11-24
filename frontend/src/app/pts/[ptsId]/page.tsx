import PtsDetailPage from './PtsDetail';

export default async function PtsPage({
  params,
}: {
  params: Promise<{ ptsId: string }>;
}) {
  const { ptsId } = await params;

  return <PtsDetailPage id={ptsId} />;
}
