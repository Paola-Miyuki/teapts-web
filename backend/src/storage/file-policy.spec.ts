import {
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
} from './file-policy';

describe('file policy', () => {
  it('allows PDF, PNG, JPG, DOC and DOCX', () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(5);

    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(isAllowedMimeType(mimeType)).toBe(true);
    }
  });

  it.each(['text/html', 'application/json', 'image/gif', '', 'PDF'])(
    'refuses %s',
    (mimeType) => {
      expect(isAllowedMimeType(mimeType)).toBe(false);
    },
  );

  it('limits files to 5 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});
