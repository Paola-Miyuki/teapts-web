// Este arquivo testa a validação da query da listagem de documentos, pelo
// mesmo ValidationPipe global da aplicação.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { DocumentCategory } from '../enums/document-category.enum';
import { GetDocumentsQueryDto } from './get-documents-query.dto';

function normalize(query: unknown) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetDocumentsQueryDto,
  }) as Promise<GetDocumentsQueryDto>;
}

async function errorBody(query: unknown) {
  const error: unknown = await normalize(query).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('GetDocumentsQueryDto', () => {
  it('uses the default pagination and no filters', async () => {
    await expect(normalize({})).resolves.toMatchObject({
      page: 1,
      limit: 20,
      q: undefined,
      category: undefined,
    });
  });

  it('trims the search and treats an empty one as no search', async () => {
    await expect(normalize({ q: '  laudo ' })).resolves.toMatchObject({
      q: 'laudo',
    });
    await expect(normalize({ q: '   ' })).resolves.toMatchObject({
      q: undefined,
    });
  });

  it('keeps %, _ and \\ in the search as plain text', async () => {
    await expect(normalize({ q: '50%_\\' })).resolves.toMatchObject({
      q: '50%_\\',
    });
  });

  it('accepts one category, a comma list and a repeated parameter', async () => {
    await expect(
      normalize({ category: 'medical_report' }),
    ).resolves.toMatchObject({ category: [DocumentCategory.MEDICAL_REPORT] });
    await expect(
      normalize({ category: 'tcle, image_authorization' }),
    ).resolves.toMatchObject({
      category: [DocumentCategory.TCLE, DocumentCategory.IMAGE_AUTHORIZATION],
    });
    await expect(
      normalize({ category: ['tcle', 'tcle', 'exam'] }),
    ).resolves.toMatchObject({
      category: [DocumentCategory.TCLE, DocumentCategory.EXAM],
    });
  });

  it('treats an empty category as no filter', async () => {
    await expect(normalize({ category: '' })).resolves.toMatchObject({
      category: undefined,
    });
  });

  it('rejects a category outside the list with the parameter name', async () => {
    await expect(errorBody({ category: 'tcle,xyz' })).resolves.toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: category',
    });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '51' }, 'limit'],
    [{ limit: 'abc' }, 'limit'],
  ])('rejects %j with the parameter name', async (query, parameter) => {
    await expect(errorBody(query)).resolves.toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${parameter}`,
    });
  });
});
