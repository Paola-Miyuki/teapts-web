'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

import Icon from '@/components/Icon';
import Logo from '@/components/Logo';
import ui from '@/components/ui.module.css';
import {
  GENDER_LABELS,
  SEX_LABELS,
  type Gender,
  type Sex,
} from '@/lib/account';
import { isValidCpf, maskCpf, maskPhone, onlyDigits } from '@/lib/format';
import { initSuperTokens } from '@/lib/supertokens';
import login from '../login/login.module.css';
import styles from './signup.module.css';

const REQUIRED_MESSAGE =
  'Preencha todos os campos obrigatórios antes de continuar';

function translateSignupError(message: string) {
  if (/at least 8 characters.*including a number/i.test(message)) {
    return 'A senha precisa ter pelo menos 8 caracteres e conter um número';
  }

  if (/at least 8 characters/i.test(message)) {
    return 'A senha deve ter pelo menos 8 caracteres';
  }

  if (/including a number|contain.*number|number/i.test(message)) {
    return 'A senha deve conter pelo menos um número';
  }

  if (/email.*already exists|email.*already registered/i.test(message)) {
    return 'Este e-mail já está cadastrado';
  }

  if (/invalid email|valid email/i.test(message)) {
    return 'Informe um e-mail válido';
  }

  if (/not optional/i.test(message)) {
    return REQUIRED_MESSAGE;
  }

  // Mensagens do backend já em português (CPF, data, telefone).
  if (/[ãçéêíóú]|CPF|inválid/i.test(message)) {
    return message.endsWith('.') ? message : `${message}.`;
  }

  return 'Verifique os dados informados e tente novamente';
}

function requirementClass(met: boolean, typing: boolean) {
  if (met) {
    return ui.requirementMet;
  }

  return typing ? ui.requirementMissing : '';
}

function todayIso() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${today.getFullYear()}-${month}-${day}`;
}

function Optional() {
  return <span className={styles.optional}> (opcional)</span>;
}

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    initSuperTokens();
  }, []);

  // Estados do formulário
  const [name, setName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados de interface
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const passwordHasMinLength = password.length >= 8;
  const passwordHasNumber = /\d/.test(password);
  const passwordIsInvalid =
    (password.length > 0 || hasSubmitted) &&
    (!passwordHasMinLength || !passwordHasNumber);
  const confirmPasswordIsInvalid =
    (confirmPassword.length > 0 || hasSubmitted) &&
    (!confirmPassword || password !== confirmPassword);
  const missing = (value: string) => hasSubmitted && !value.trim();
  const cpfIsInvalid = hasSubmitted && !isValidCpf(cpf);
  const phoneDigits = onlyDigits(phone);
  const phoneIsInvalid =
    hasSubmitted && phoneDigits.length > 0 && phoneDigits.length < 10;
  const birthDateIsInvalid =
    hasSubmitted && (!birthDate || birthDate > todayIso());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setError(null);

    if (
      !name.trim() ||
      !birthDate ||
      !sex ||
      !cpf.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError(REQUIRED_MESSAGE);
      return;
    }

    if (birthDate > todayIso()) {
      setError('Informe uma data de nascimento válida');
      return;
    }

    if (!isValidCpf(cpf)) {
      setError('Informe um CPF válido');
      return;
    }

    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      setError('Informe o telefone com DDD');
      return;
    }

    if (!passwordHasMinLength || !passwordHasNumber) {
      setError(
        'A senha precisa ter pelo menos 8 caracteres e conter um número',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setIsLoading(true);

    try {
      const response = await EmailPassword.signUp({
        formFields: [
          { id: 'name', value: name.trim() },
          { id: 'socialName', value: socialName.trim() },
          { id: 'birthDate', value: birthDate },
          { id: 'sex', value: sex },
          { id: 'gender', value: gender },
          { id: 'cpf', value: onlyDigits(cpf) },
          { id: 'email', value: email.trim() },
          { id: 'phone', value: phoneDigits },
          { id: 'password', value: password },
        ],
      });

      if (response.status === 'OK') {
        router.push('/login?registered=true');
        return;
      }

      if (response.status === 'FIELD_ERROR') {
        setError(
          [
            ...new Set(
              response.formFields.map((field) =>
                translateSignupError(field.error),
              ),
            ),
          ].join(' '),
        );
        return;
      }

      setError('Verifique os dados informados e tente novamente');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(translateSignupError(err.message));
      } else {
        setError('Erro ao conectar com o servidor');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={login.page}>
      <header className={login.header}>
        <div className={login.brand}>
          <Logo caption="Programa Terapêutico Singular" />
        </div>

        <button type="button" className={login.helpButton}>
          <Icon name="help" />
          Precisa de ajuda?
        </button>
      </header>

      <main className={login.main}>
        <section
          className={`${login.login} ${styles.signup}`}
          aria-labelledby="signup-title"
        >
          <div className={login.formWrapper}>
            <h1 id="signup-title">Crie sua conta</h1>

            <p className={login.intro}>Preencha seus dados para começar.</p>

            {error && (
              <div
                className={`${ui.alert} ${ui.alertError} ${styles.signupAlert}`}
                role="alert"
              >
                <div className={`${ui.alertIcon} ${ui.alertIconError}`}>
                  <Icon name="alertCircle" />
                </div>
                <div>
                  <strong>Não foi possível concluir o cadastro</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="su-grid">
                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="name" className={ui.label}>
                    Nome completo
                  </label>
                  <input
                    className={ui.input}
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Digite seu nome completo"
                    value={name}
                    aria-invalid={missing(name)}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="social-name" className={ui.label}>
                    Nome social
                    <Optional />
                  </label>
                  <input
                    className={ui.input}
                    id="social-name"
                    name="social-name"
                    type="text"
                    placeholder="Como você quer ser chamado"
                    value={socialName}
                    onChange={(e) => setSocialName(e.target.value)}
                  />
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="birth" className={ui.label}>
                    Data de nascimento
                  </label>
                  <input
                    className={ui.input}
                    id="birth"
                    name="birth"
                    type="date"
                    required
                    autoComplete="bday"
                    max={todayIso()}
                    value={birthDate}
                    aria-invalid={birthDateIsInvalid}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="sex" className={ui.label}>
                    Sexo
                  </label>
                  <select
                    className={`${ui.input} su-select`}
                    id="sex"
                    name="sex"
                    required
                    value={sex}
                    aria-invalid={missing(sex)}
                    onChange={(e) => setSex(e.target.value as Sex | '')}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    <option value="female">{SEX_LABELS.female}</option>
                    <option value="male">{SEX_LABELS.male}</option>
                  </select>
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="gender" className={ui.label}>
                    Gênero
                    <Optional />
                  </label>
                  <select
                    className={`${ui.input} su-select`}
                    id="gender"
                    name="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender | '')}
                  >
                    <option value="">Selecione</option>
                    {(Object.keys(GENDER_LABELS) as Gender[]).map((value) => (
                      <option key={value} value={value}>
                        {GENDER_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="cpf" className={ui.label}>
                    CPF
                  </label>
                  <input
                    className={ui.input}
                    id="cpf"
                    name="cpf"
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="000.000.000-00"
                    value={cpf}
                    aria-invalid={cpfIsInvalid}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                  />
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="email" className={ui.label}>
                    E-mail
                  </label>
                  <input
                    className={ui.input}
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Digite seu e-mail"
                    value={email}
                    aria-invalid={missing(email)}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="phone" className={ui.label}>
                    Telefone
                    <Optional />
                  </label>
                  <input
                    className={ui.input}
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    aria-invalid={phoneIsInvalid}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                  />
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="password" className={ui.label}>
                    Criar senha
                  </label>
                  <div className={login.passwordWrapper}>
                    <input
                      className={ui.input}
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Crie uma senha"
                      value={password}
                      aria-invalid={passwordIsInvalid}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className={login.revealButton}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? 'Ocultar senha' : 'Mostrar senha'
                      }
                      aria-pressed={showPassword}
                    >
                      <Icon name={showPassword ? 'eye' : 'eyeClosed'} />
                    </button>
                  </div>
                  <div className={ui.requirements}>
                    <p className={ui.requirementsTitle}>Requisitos da senha</p>
                    <ul>
                      <li
                        className={requirementClass(
                          passwordHasMinLength,
                          password.length > 0,
                        )}
                      >
                        <span aria-hidden="true">
                          {passwordHasMinLength ? '✓' : '•'}
                        </span>{' '}
                        Oito caracteres ou mais
                      </li>
                      <li
                        className={requirementClass(
                          passwordHasNumber,
                          password.length > 0,
                        )}
                      >
                        <span aria-hidden="true">
                          {passwordHasNumber ? '✓' : '•'}
                        </span>{' '}
                        Pelo menos um número
                      </li>
                    </ul>
                  </div>
                </div>

                <div className={`${ui.field} ${login.field}`}>
                  <label htmlFor="confirm-password" className={ui.label}>
                    Repita a senha
                  </label>
                  <div className={login.passwordWrapper}>
                    <input
                      className={ui.input}
                      id="confirm-password"
                      name="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Digite sua senha novamente"
                      value={confirmPassword}
                      aria-invalid={confirmPasswordIsInvalid}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className={login.revealButton}
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      aria-label={
                        showConfirmPassword
                          ? 'Ocultar confirmação da senha'
                          : 'Mostrar confirmação da senha'
                      }
                      aria-pressed={showConfirmPassword}
                    >
                      <Icon name={showConfirmPassword ? 'eye' : 'eyeClosed'} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`${ui.btn} ${ui.btnPrimary} ${ui.btnBlock} ${login.mainButton}`}
              >
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>

            <div className={login.divider}>
              <span>Já tem uma conta?</span>
            </div>

            <Link
              href="/login"
              className={`${ui.btn} ${ui.btnSecondary} ${ui.btnBlock} ${login.mainButton}`}
            >
              Entrar
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
