import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Path aliases (e.g. the ones added by `nest g library`) live in tsconfig.json,
// so they are read from there instead of being duplicated here.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  cacheDirectory: '<rootDir>/.jest-cache',
  clearMocks: true,
  restoreMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { module: 'ESNext', isolatedModules: false },
        // Mesmo plugin do nest-cli.json (ver test/swagger-plugin-transformer.mjs).
        astTransformers: {
          before: [
            {
              path: '<rootDir>/test/swagger-plugin-transformer.mjs',
              options: { classValidatorShim: true, introspectComments: true },
            },
          ],
        },
      },
    ],
  },
  moduleNameMapper: {
    // Imports com `.js` que o plugin do Swagger gera (mesmo mapeamento do e2e).
    '^(\\.{1,2}/.*)\\.js$': '$1',
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
    '!src/database/data-source.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
