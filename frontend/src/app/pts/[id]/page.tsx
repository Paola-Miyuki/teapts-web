import PtsDetailPage from './PtsDetail';

export default async function PtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PtsDetailPage id={id} />;
}
