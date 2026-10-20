import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import * as api from '../api/ptsApi';
import { CreatePts } from '../CreatePts';

vi.mock('../api/ptsApi');
vi.mock('@/lib/supertokens', () => ({ initSuperTokens: vi.fn() }));

const SOCIAL = 'Paciente em situação de vulnerabilidade social.';
const createdPts = {
  id: 100,
  patientId: 25,
  responsibleProfessionalId: 10,
  socialSituation: SOCIAL,
  status: 'DRAFT',
  createdAt: '2026-10-06T18:00:00.000Z',
  teamProfessionalIds: [11, 15],
};

async function renderScreen() {
  render(<CreatePts />);
  await screen.findByLabelText(/^paciente$/i); // aguarda carregar os dados
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  withTeam = true,
) {
  await user.selectOptions(screen.getByLabelText(/^paciente$/i), '25');
  if (withTeam) {
    await user.click(screen.getByText(/selecione os profissionais/i));
    await user.click(screen.getByLabelText(/Ana Lima/));
    await user.click(screen.getByLabelText(/Bruno Souza/));
  }
  await user.type(screen.getByLabelText(/situação social/i), SOCIAL);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getCurrentProfessional).mockResolvedValue({
    id: 10,
    name: 'Kaio Felipe',
    specialty: 'Psicólogo(a)',
  });
  vi.mocked(api.listEligiblePatients).mockResolvedValue([
    { id: 25, name: 'Maria Silva' },
    { id: 26, name: 'Diego Alves' },
  ]);
  vi.mocked(api.listProfessionals).mockResolvedValue([
    { id: 10, name: 'Kaio Felipe', specialty: 'Psicólogo(a)' }, // responsável: não deve aparecer na equipe
    { id: 11, name: 'Ana Lima', specialty: 'Médica' },
    { id: 15, name: 'Bruno Souza', specialty: 'Fisioterapeuta' },
  ]);
});

describe('CreatePts', () => {
  it('carrega os dados e não lista o próprio responsável na equipe', async () => {
    await renderScreen();
    expect(
      screen.getByRole('option', { name: 'Maria Silva' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Ana Lima/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Kaio Felipe/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/seu perfil profissional/i)).toHaveValue(
      'Kaio Felipe · Psicólogo(a)',
    );
  });

  it('valida campos obrigatórios e não chama a API', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(screen.getByText('Selecione o paciente.')).toBeInTheDocument();
    expect(
      screen.getByText('Descreva a situação social do paciente.'),
    ).toBeInTheDocument();
    expect(api.createPts).not.toHaveBeenCalled();
  });

  it('cria com o payload correto, mostra loading e informa DRAFT', async () => {
    const user = userEvent.setup();
    let resolve!: (v: typeof createdPts) => void;
    vi.mocked(api.createPts).mockReturnValue(new Promise((r) => (resolve = r)));

    await renderScreen();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(
      await screen.findByRole('button', { name: /criando proposta/i }),
    ).toBeDisabled();
    expect(api.createPts).toHaveBeenCalledWith({
      professionalId: 10,
      patientId: 25,
      socialSituation: SOCIAL,
      teamProfessionalIds: [11, 15],
    });

    resolve(createdPts);
    expect(await screen.findByTestId('pts-created')).toHaveTextContent('DRAFT');
    expect(
      screen.getByRole('link', { name: /abrir proposta/i }),
    ).toHaveAttribute('href', '/pts/100');
  });

  it('permite criar sem equipe (opcional)', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPts).mockResolvedValue({
      ...createdPts,
      teamProfessionalIds: [],
    });
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    await waitFor(() =>
      expect(api.createPts).toHaveBeenCalledWith(
        expect.objectContaining({ teamProfessionalIds: [] }),
      ),
    );
  });

  it('trata PTS_ACTIVE_EXISTS e destaca o campo paciente', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPts).mockRejectedValue(
      new ApiError(
        409,
        'PTS_ACTIVE_EXISTS',
        'O paciente já possui um PTS aprovado e ativo.',
      ),
    );
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(
      await screen.findByText('Este paciente já tem um PTS ativo'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^paciente$/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /criar proposta/i }),
    ).toBeEnabled();
  });

  it('trata profissional sem autorização para o perfil (403)', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPts).mockRejectedValue(
      new ApiError(403, 'PROFESSIONAL_NOT_AUTHORIZED'),
    );
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(
      await screen.findByText('Perfil sem autorização'),
    ).toBeInTheDocument();
  });

  it('exibe a mensagem da API em erros não mapeados e preserva o formulário', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createPts).mockRejectedValue(
      new ApiError(500, 'INTERNAL', 'Falha interna.'),
    );
    await renderScreen();
    await fillForm(user, false);
    await user.click(screen.getByRole('button', { name: /criar proposta/i }));

    expect(await screen.findByText('Falha interna.')).toBeInTheDocument();
    expect(screen.getByLabelText(/situação social/i)).toHaveValue(SOCIAL);
  });

  it('permite tentar de novo quando o carregamento inicial falha', async () => {
    const user = userEvent.setup();
    vi.mocked(api.listEligiblePatients).mockRejectedValueOnce(
      new ApiError(0, 'NETWORK_ERROR'),
    );
    render(<CreatePts />);
    await user.click(
      await screen.findByRole('button', { name: /tentar novamente/i }),
    );
    expect(await screen.findByLabelText(/^paciente$/i)).toBeInTheDocument();
  });
});
