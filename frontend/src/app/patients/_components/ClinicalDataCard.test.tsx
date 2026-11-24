import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ClinicalDataCard from './ClinicalDataCard';

const API = 'http://localhost:3000';

const CLINICAL_DATA = {
  allergies: 'Dipirona',
  noKnownAllergies: false,
  clinicalHistory: 'Acompanhamento multidisciplinar.',
  surgicalHistory: 'Sem cirurgias anteriores.',
  familyHistory: 'Histórico familiar informado.',
  habits: 'Sono regular.',
  developmentalMilestones: 'Marcos dentro do esperado.',
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('ClinicalDataCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mostra os dados clínicos sem ação de edição quando está somente leitura', () => {
    render(
      <ClinicalDataCard
        patientId="patient-1"
        data={CLINICAL_DATA}
        canEdit={false}
        onSaved={jest.fn()}
      />,
    );

    expect(screen.getByText('Dipirona')).toBeInTheDocument();
    expect(
      screen.getByText('Acompanhamento multidisciplinar.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
  });

  it('edita e salva os dados clínicos pelo PATCH', async () => {
    const onSaved = jest.fn();

    const saved = {
      ...CLINICAL_DATA,
      allergies: 'Penicilina',
      clinicalHistory: 'Histórico atualizado.',
    };

    global.fetch = jest.fn().mockResolvedValue(respond(200, saved));

    render(
      <ClinicalDataCard
        patientId="patient-1"
        data={CLINICAL_DATA}
        canEdit
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    fireEvent.change(screen.getByLabelText('Alergias e restrições'), {
      target: { value: 'Penicilina' },
    });

    fireEvent.change(screen.getByLabelText('Antecedentes clínicos'), {
      target: { value: 'Histórico atualizado.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/patients/patient-1/clinical-data`,
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
        }),
      );
    });

    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string);

    expect(body).toEqual({
      allergies: 'Penicilina',
      noKnownAllergies: false,
      clinicalHistory: 'Histórico atualizado.',
      surgicalHistory: 'Sem cirurgias anteriores.',
      familyHistory: 'Histórico familiar informado.',
      habits: 'Sono regular.',
      developmentalMilestones: 'Marcos dentro do esperado.',
    });

    expect(onSaved).toHaveBeenCalledWith(saved);

    expect(
      await screen.findByText('Dados clínicos atualizados com sucesso.'),
    ).toBeInTheDocument();
  });

  it('limpa e bloqueia alergias ao marcar nenhuma alergia conhecida', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respond(200, {
        ...CLINICAL_DATA,
        allergies: null,
        noKnownAllergies: true,
      }),
    );

    render(
      <ClinicalDataCard
        patientId="patient-1"
        data={CLINICAL_DATA}
        canEdit
        onSaved={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    const checkbox = screen.getByRole('checkbox', {
      name: 'Nenhuma alergia conhecida',
    });

    fireEvent.click(checkbox);

    const allergies = screen.getByLabelText('Alergias e restrições');

    expect(allergies).toBeDisabled();
    expect(allergies).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string);

    expect(body.noKnownAllergies).toBe(true);
    expect(body.allergies).toBe('');
  });

  it('mostra o erro da API e remove a ação de edição depois de um 403', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao profissional.',
      }),
    );

    render(
      <ClinicalDataCard
        patientId="patient-1"
        data={CLINICAL_DATA}
        canEdit
        onSaved={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Acesso restrito ao profissional.'),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
  });
});