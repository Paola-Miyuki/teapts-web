import ReassessmentClient from './ReassessmentClient';

export const metadata = {
  title: 'Registrar reavaliação · TEA-PTS',
};

export default async function ReassessmentRoute({
  params,
}: {
  params: Promise<{ ptsId: string }>;
}) {
  const { ptsId } = await params;

  return <ReassessmentClient ptsId={ptsId} />;
}
