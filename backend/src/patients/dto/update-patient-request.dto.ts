// Este arquivo define e valida o corpo do `PATCH /patients/:patientId`, o
// "Editar paciente" de `paciente.html`. Os campos que não vêm ficam como
// estão; `null` ou vazio limpa os campos opcionais. A regra do responsável
// tutelar (obrigatório para menor de 18 anos) vale para o paciente resultante
// e é aplicada pelo service, assim como a restrição dos dados da conta ao
// administrador.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Gender } from '../../accounts/enums/gender.enum';
import { Sex } from '../../accounts/enums/sex.enum';
import { onlyDigits } from '../../auth/sign-up-fields';
import { UFS, type Uf } from '../../professionals/enums/uf.enum';
import { EducationLevel } from '../enums/education-level.enum';

/** Texto obrigatório quando vem: espaços externos saem. */
const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Texto opcional que pode ser limpo: vazio vira null. */
const trimOptionalText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Só dígitos; vazio vira null. */
const digitsOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? onlyDigits(value) || null : value;

/** Só dígitos, sem anular o valor vazio (campo obrigatório). */
const digits = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? onlyDigits(value) : value;

const required = (message: string) => [
  ValidateIf((_: unknown, value: unknown) => value !== undefined),
  IsString({ message }),
  IsNotEmpty({ message }),
];

function Required(message: string): PropertyDecorator {
  return (target, key) => {
    for (const decorator of required(message)) {
      decorator(target, key);
    }
  };
}

export class UpdatePatientAddressDto {
  @ApiPropertyOptional({ example: '80045140', description: 'CEP, só dígitos.' })
  @Transform(digits)
  @Required('Informe o CEP.')
  @Matches(/^\d{8}$/, { message: 'Informe um CEP válido.' })
  zipCode?: string;

  @ApiPropertyOptional({ example: 'Rua Itupava' })
  @Transform(trimText)
  @Required('Informe o logradouro.')
  street?: string;

  @ApiPropertyOptional({ example: '1240' })
  @Transform(trimText)
  @Required('Informe o número.')
  number?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'ap. 32' })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe um complemento válido.' })
  complement?: string | null;

  @ApiPropertyOptional({ example: 'Alto da XV' })
  @Transform(trimText)
  @Required('Informe o bairro.')
  district?: string;

  @ApiPropertyOptional({ example: 'Curitiba' })
  @Transform(trimText)
  @Required('Informe o município.')
  city?: string;

  @ApiPropertyOptional({ enum: UFS, example: 'pr' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(UFS, { message: 'Informe uma UF válida.' })
  state?: Uf;
}

/** Corpo do `PATCH /patients/:patientId`. */
export class UpdatePatientRequestDto {
  // Dados da conta (só o administrador; o profissional recebe 403).
  @ApiPropertyOptional({ example: 'Ana Clara Ribeiro' })
  @Transform(trimText)
  @Required('Informe um nome válido.')
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe um nome social válido.' })
  socialName?: string | null;

  @ApiPropertyOptional({ example: '2019-04-18' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Informe uma data de nascimento válida.',
  })
  birthDate?: string;

  @ApiPropertyOptional({ enum: Sex })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(Object.values(Sex), { message: 'Informe um sexo válido.' })
  sex?: Sex;

  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsIn(Object.values(Gender), { message: 'Informe um gênero válido.' })
  gender?: Gender | null;

  @ApiPropertyOptional({ example: '111.444.777-35', description: 'CPF.' })
  @Transform(digits)
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\d{11}$/, { message: 'Informe um CPF válido.' })
  cpf?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '(41) 99812-3344',
  })
  @Transform(digitsOrNull)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Matches(/^\d{10,11}$/, { message: 'Informe um telefone válido, com DDD.' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'ribeiro.familia@gmail.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Informe um e-mail válido.',
  })
  email?: string;

  // Dados do paciente (administrador e equipe de PTS ativo, RN024).
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Juliana Ribeiro',
    description: 'Obrigatório para menor de 18 anos.',
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe um responsável tutelar válido.' })
  guardianName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '(41) 99701-5522',
  })
  @Transform(digitsOrNull)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Matches(/^\d{10,11}$/, {
    message: 'Informe um telefone válido para o responsável tutelar, com DDD.',
  })
  guardianPhone?: string | null;

  @ApiPropertyOptional({ type: UpdatePatientAddressDto })
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => UpdatePatientAddressDto)
  address?: UpdatePatientAddressDto;

  @ApiPropertyOptional({ example: 'Juliana Ribeiro' })
  @Transform(trimText)
  @Required('Informe a filiação 1.')
  filiation1?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'João Ribeiro',
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe uma filiação 2 válida.' })
  filiation2?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'UBS Bairro Alto',
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe uma unidade de referência válida.' })
  referenceUnit?: string | null;

  @ApiPropertyOptional({ enum: EducationLevel, nullable: true })
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsIn(Object.values(EducationLevel), {
    message: 'Informe uma escolaridade válida.',
  })
  educationLevel?: EducationLevel | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Escola Municipal Papa João XXIII',
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe uma instituição de ensino válida.' })
  schoolName?: string | null;
}

export const ACCOUNT_FIELDS = [
  'name',
  'socialName',
  'birthDate',
  'sex',
  'gender',
  'cpf',
  'phone',
  'email',
] as const satisfies readonly (keyof UpdatePatientRequestDto)[];
