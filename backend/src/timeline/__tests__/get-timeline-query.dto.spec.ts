import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  DEFAULT_PAGE as DEFAULT_TIMELINE_PAGE,
  DEFAULT_PAGE_LIMIT as DEFAULT_TIMELINE_LIMIT,
} from '../../common/pagination/pagination-query.dto';
import { GetTimelineQueryDto } from '../dto/get-timeline-query.dto';

async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(GetTimelineQueryDto, query);
  const errors = await validate(dto);

  return { dto, errors };
}

/** Mensagem da primeira constraint do primeiro erro, como a API devolve. */
function firstMessage(errors: Awaited<ReturnType<typeof validate>>) {
  return Object.values(errors[0]?.constraints ?? {})[0];
}

describe('GetTimelineQueryDto', () => {
  it('usa os valores padrão de página e limite', async () => {
    const { dto, errors } = await validateQuery({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(DEFAULT_TIMELINE_PAGE);
    expect(dto.limit).toBe(DEFAULT_TIMELINE_LIMIT);
  });

  it('converte página e limite recebidos como strings', async () => {
    const { dto, errors } = await validateQuery({ page: '2', limit: '50' });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it.each([
    ['page', '0'],
    ['page', 'abc'],
    ['limit', '51'],
    ['limit', '0'],
  ])('rejeita %s = %s', async (field, value) => {
    const { errors } = await validateQuery({ [field]: value });

    expect(firstMessage(errors)).toBe(`Parâmetro inválido: ${field}`);
    // Mesmo status das outras listagens (PaginationQueryDto).
    expect(Object.values(errors[0].contexts ?? {})[0]).toEqual({
      status: 'ERROR',
    });
  });

  it('tira os espaços da busca e trata vazio como sem busca', async () => {
    const filled = await validateQuery({ q: '  atividade  ' });
    const empty = await validateQuery({ q: '   ' });

    expect(filled.dto.q).toBe('atividade');
    expect(empty.dto.q).toBeUndefined();
    expect(empty.errors).toHaveLength(0);
  });

  it('aceita um tipo ou vários, por vírgula ou repetidos', async () => {
    const single = await validateQuery({ type: 'activity' });
    const comma = await validateQuery({ type: 'activity, document' });
    const repeated = await validateQuery({
      type: ['pts', 'team_member', 'pts'],
    });

    expect(single.dto.type).toEqual(['activity']);
    expect(comma.dto.type).toEqual(['activity', 'document']);
    expect(repeated.dto.type).toEqual(['pts', 'team_member']);
    expect([
      ...single.errors,
      ...comma.errors,
      ...repeated.errors,
    ]).toHaveLength(0);
  });

  it('rejeita tipo fora da lista', async () => {
    const { errors } = await validateQuery({ type: 'activity,goal' });

    expect(firstMessage(errors)).toBe('Parâmetro inválido: type');
  });

  it('valida o authorId como UUID', async () => {
    const valid = await validateQuery({
      authorId: '6f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f',
    });
    const invalid = await validateQuery({ authorId: 'joao' });

    expect(valid.errors).toHaveLength(0);
    expect(firstMessage(invalid.errors)).toBe('Parâmetro inválido: authorId');
  });

  it('aceita a ordem asc ou desc e recusa outra', async () => {
    const asc = await validateQuery({ order: 'asc' });
    const none = await validateQuery({});
    const invalid = await validateQuery({ order: 'crescente' });

    expect(asc.errors).toHaveLength(0);
    expect(asc.dto.order).toBe('asc');
    expect(none.dto.order).toBeUndefined();
    expect(firstMessage(invalid.errors)).toBe('Parâmetro inválido: order');
  });

  it('aceita o período em AAAA-MM-DD', async () => {
    const { dto, errors } = await validateQuery({
      from: '2026-11-01',
      to: '2026-11-30',
    });

    expect(errors).toHaveLength(0);
    expect(dto.from).toBe('2026-11-01');
    expect(dto.to).toBe('2026-11-30');
  });

  it.each([
    ['from', '01/11/2026'],
    ['from', '2026-02-30'],
    ['to', '2026-11-30T10:00:00Z'],
    ['to', '2026-13-01'],
  ])('rejeita %s = %s', async (field, value) => {
    const { errors } = await validateQuery({ [field]: value });

    expect(firstMessage(errors)).toBe(`Parâmetro inválido: ${field}`);
  });
});
