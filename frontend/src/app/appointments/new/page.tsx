import RegisterAppointmentClient from './RegisterAppointmentClient';

export const metadata = {
  title: 'Registrar atendimento · TEA-PTS',
};

export default async function NewAppointmentRoute({
  searchParams,
}: {
  searchParams: Promise<{ pts?: string; activity?: string }>;
}) {
  const { pts, activity } = await searchParams;

  return <RegisterAppointmentClient ptsId={pts} activityId={activity} />;
}
