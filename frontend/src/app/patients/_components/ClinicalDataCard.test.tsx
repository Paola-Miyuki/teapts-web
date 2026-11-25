import { render, screen } from '@testing-library/react';

import ClinicalDataCard from './ClinicalDataCard';

const CLINICAL_DATA = {
  allergies: 'Dipirona',
  noKnownAllergies: false,
  clinicalHistory: 'Acompanhamento multidisciplinar.',
  surgicalHistory: 'Sem cirurgias anteriores.',
  familyHistory: 'Histórico familiar informado.',
  habits: 'Sono regular.',
  developmentalMilestones: 'Marcos dentro do esperado.',
};

describe('ClinicalDataCard', () => {
  it('mostra os dados clínicos só para leitura, sem ação de edição', () => {
    render(<ClinicalDataCard data={CLINICAL_DATA} />);

    expect(screen.getByText('Dipirona')).toBeInTheDocument();
    expect(
      screen.getByText('Acompanhamento multidisciplinar.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sem cirurgias anteriores.')).toBeInTheDocument();
    expect(screen.getByText('Sono regular.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
  });

  it('mostra "Nenhuma alergia conhecida" e "Não informado" nos campos vazios', () => {
    render(
      <ClinicalDataCard
        data={{
          ...CLINICAL_DATA,
          allergies: null,
          noKnownAllergies: true,
          habits: null,
        }}
      />,
    );

    expect(screen.getByText('Nenhuma alergia conhecida')).toBeInTheDocument();
    expect(screen.getByText('Não informado')).toBeInTheDocument();
  });
});
