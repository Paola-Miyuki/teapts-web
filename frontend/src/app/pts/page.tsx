import ActivePtsScreen from './_components/ActivePtsScreen';

export const metadata = {
  title: 'Programa Terapêutico Singular · TEA-PTS',
};

// RFPTS004 – o paciente vê o próprio PTS ativo.
export default function PtsPage() {
  return <ActivePtsScreen currentHref="/pts" />;
}
