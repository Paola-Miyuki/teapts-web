import { render, screen, within } from '@testing-library/react';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PtsOverview from './_components/PtsOverview';

const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const PROFESSIONAL_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const PTS_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';

const ACTIVE_PTS = {
  id: PTS_ID,
  status: 'running',
  createdAt: '2026-10-15T12:00:00.000Z',
  acceptedAt: '2026-10-15T12:30:00.000Z',
  beganAt: '2026-10-20T12:00:00.000Z',
  patient: { id: PATIENT_ID, name: 'Priscila Martins' },
  responsible: {
    id: PROFESSIONAL_ID,
    name: 'Kaio Segunda Conta',
    specialism: { id: 'psychologist', name: 'Psicologia' },
  },
  team: [],
};

const TIMELINE = {
  data: [
    {
      id: 'rec-1',
      type: 'document_uploaded',
      targetType: 'document',
      targetId: 'doc-1',
      description: 'Kaio Segunda Conta enviou o documento Laudo neurológico',
      happenedAt: '2026-11-12T17:45:00.000Z',
      author: { id: 'acc-1', name: 'Kaio Segunda Conta' },
      assignedTo: null,
    },
    {
      id: 'rec-2',
      type: 'activity_approved',
      targetType: 'activity',
      targetId: 'act-1',
      description:
        'Kaio Segunda Conta aprovou a atividade Integração sensorial',
      happenedAt: '2026-11-11T17:45:00.000Z',
      author: { id: 'acc-1', name: 'Kaio Segunda Conta' },
      assignedTo: null,
    },
  ],
  pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
};

function account(overrides: Partial<Account>): Account {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Conta de teste',
    email: 'conta@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [],
    ...overrides,
  };
}

function mockApi(timeline: unknown) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => (url.includes('/timeline') ? timeline : ACTIVE_PTS),
    } as Response),
  ) as jest.Mock;
}

describe('Timeline no Meu PTS (RFTL001)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/pts');
  });

  it('mostra ao paciente a timeline do PTS ativo, sem link de documento', async () => {
    mockApi({
      ...TIMELINE,
      data: TIMELINE.data.map((record) =>
        record.targetType === 'document'
          ? { ...record, targetId: null }
          : record,
      ),
    });

    render(
      <PtsOverview
        account={account({ patientProfileId: PATIENT_ID })}
        patientId={PATIENT_ID}
      />,
    );

    const timeline = within(
      await screen.findByRole('region', { name: 'Timeline' }),
    );

    expect(
      await timeline.findByText(
        'Kaio Segunda Conta enviou o documento Laudo neurológico',
      ),
    ).toBeInTheDocument();
    expect(
      timeline.queryByRole('link', { name: 'Ver documento' }),
    ).not.toBeInTheDocument();
    expect(
      timeline.getByRole('link', { name: 'Ver atividade' }),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `http://localhost:3000/pts/${PTS_ID}/timeline?page=1&limit=10`,
      expect.anything(),
    );
  });

  it('mostra ao profissional da equipe o link dos documentos', async () => {
    mockApi(TIMELINE);

    render(
      <PtsOverview
        account={account({ professionalProfileIds: [PROFESSIONAL_ID] })}
        patientId={PATIENT_ID}
      />,
    );

    const timeline = within(
      await screen.findByRole('region', { name: 'Timeline' }),
    );

    expect(
      await timeline.findByRole('link', { name: 'Ver documento' }),
    ).toHaveAttribute('href', `/patients/${PATIENT_ID}#documentos`);
  });
});
