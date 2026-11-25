import PtsDetailPage from './PtsDetail';

export default async function PtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ptsId: string }>;
  searchParams: Promise<{
    readonly?: string;
    version?: string;
    appointment?: string;
  }>;
}) {
  const [{ ptsId }, query] = await Promise.all([params, searchParams]);
  const version = Number(query.version);

  return (
    <PtsDetailPage
      id={ptsId}
      readOnly={query.readonly === '1'}
      appointmentRegistered={query.appointment === 'registered'}
      version={Number.isInteger(version) && version > 0 ? version : undefined}
    />
  );
}
