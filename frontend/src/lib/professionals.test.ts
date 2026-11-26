import {
  COUNCILS,
  councilOf,
  createProfessional,
  SPECIALISMS,
  updateProfessional,
} from './professionals';

describe('especialidades', () => {
  it('tem as 20 da lista fixa, cada uma com um conselho conhecido', () => {
    expect(SPECIALISMS).toHaveLength(20);
    expect(new Set(SPECIALISMS.map((item) => item.value)).size).toBe(20);

    for (const { council } of SPECIALISMS) {
      expect(COUNCILS).toContain(council);
    }
  });

  it.each([
    ['psychologist', 'CRP'],
    ['neuropsychologist', 'CRP'],
    ['speech_therapist', 'CRFa'],
    ['occupational_therapist', 'Crefito'],
    ['pediatric_dentist', 'CRO'],
    ['', ''],
  ])('councilOf(%s) = %s', (specialism, council) => {
    expect(councilOf(specialism)).toBe(council);
  });
});

describe('createProfessional', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'new' }),
    });
  });

  it('envia o POST com os cookies, aparando o texto e a UF em minúsculas', async () => {
    await createProfessional({
      accountId: 'acc',
      specialism: 'psychologist',
      councilNumber: ' 12345 ',
      councilState: 'PR',
      institution: ' Clínica ',
      cnes: ' 1234567 ',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/professionals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc',
          specialism: 'psychologist',
          councilNumber: '12345',
          councilState: 'pr',
          institution: 'Clínica',
          cnes: '1234567',
        }),
        credentials: 'include',
      },
    );
  });

  it('omite instituição e CNES em branco', async () => {
    await createProfessional({
      accountId: 'acc',
      specialism: 'doctor',
      councilNumber: '1',
      councilState: 'sc',
      institution: '  ',
      cnes: '',
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];

    expect(JSON.parse(init.body)).toEqual({
      accountId: 'acc',
      specialism: 'doctor',
      councilNumber: '1',
      councilState: 'sc',
    });
  });
});

describe('updateProfessional', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'prof' }),
    });
  });

  it('envia o PATCH com os cookies, aparando o número e a UF em minúsculas', async () => {
    await updateProfessional('prof', {
      specialism: 'nurse',
      councilNumber: ' 5678 ',
      councilState: 'SP',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/professionals/prof',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialism: 'nurse',
          councilNumber: '5678',
          councilState: 'sp',
        }),
        credentials: 'include',
      },
    );
  });

  it('envia só a especialidade quando o registro não muda', async () => {
    await updateProfessional('prof', { specialism: 'neuropsychologist' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];

    expect(JSON.parse(init.body)).toEqual({ specialism: 'neuropsychologist' });
  });
});
