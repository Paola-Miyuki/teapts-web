'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

import Icon from '@/components/Icon';
import Logo from '@/components/Logo';
import ui from '@/components/ui.module.css';
import { initSuperTokens } from '@/lib/supertokens';
import styles from './signup.module.css';

function translateSignupError(message: string) {
  if (/at least 8 characters.*including a number/i.test(message)) {
    return 'A senha precisa ter pelo menos 8 caracteres e conter um número.';
  }

  if (/at least 8 characters/i.test(message)) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }

  if (/including a number|contain.*number|number/i.test(message)) {
    return 'A senha deve conter pelo menos um número.';
  }

  if (/email.*already exists|email.*already registered/i.test(message)) {
    return 'Este e-mail já está cadastrado.';
  }

  if (/invalid email|valid email/i.test(message)) {
    return 'Informe um e-mail válido.';
  }

  return 'Verifique os dados informados e tente novamente.';
}

function requirementClass(met: boolean, typing: boolean) {
  if (met) {
    return styles.requirementMet;
  }

  return typing ? styles.requirementMissing : '';
}

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    initSuperTokens();
  }, []);

  // Estados do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Preencha todos os campos obrigatórios antes de continuar.');
      return;
    }

    if (!passwordHasMinLength || !passwordHasNumber) {
      setError(
        'A senha precisa ter pelo menos 8 caracteres e conter um número.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await EmailPassword.signUp({
        formFields: [
          { id: 'name', value: name.trim() },
          { id: 'email', value: email.trim() },
          { id: 'password', value: password },
        ],
      });

      if (response.status === 'OK') {
        router.push('/login?registered=true');
        return;
      }

      if (response.status === 'FIELD_ERROR') {
        setError(
          response.formFields
            .map((field) => translateSignupError(field.error))
            .join(' '),
        );
        return;
      }

      setError('Verifique os dados informados e tente novamente.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(translateSignupError(err.message));
      } else {
        setError('Erro ao conectar com o servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.layout}>
        <section className={`${ui.card} ${styles.story}`}>
          <div>
            <Link
              href="/home"
              className={styles.brand}
              aria-label="TEA-PTS, início"
            >
              <Logo />
            </Link>

            <p className={ui.eyebrow}>Um novo começo no cuidado</p>

            <h1>Seu cuidado começa com uma conexão.</h1>

            <p className={styles.storyText}>
              Crie sua conta para participar da construção do seu Programa
              Terapêutico Singular.
            </p>
          </div>

          <p className={styles.storyNote}>
            Pacientes e profissionais.
            <br />
            Uma visão compartilhada do cuidado.
          </p>
        </section>

        <section className={styles.formSection} aria-labelledby="signup-title">
          <Link href="/login" className={styles.backLink}>
            <Icon name="back" className={styles.backIcon} />
            Voltar ao login
          </Link>

          <h2 id="signup-title">Crie sua conta</h2>

          <p className={styles.intro}>Preencha seus dados para começar.</p>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
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

            <div className={ui.field}>
              <label htmlFor="name" className={ui.label}>
                Nome completo
              </label>
              <input
                className={ui.input}
                id="name"
                name="name"
                type="text"
                required
                placeholder="Digite seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className={ui.field}>
              <label htmlFor="email" className={ui.label}>
                E-mail
              </label>
              <input
                className={ui.input}
                id="email"
                name="email"
                type="email"
                required
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={ui.field}>
              <label htmlFor="password" className={ui.label}>
                Criar senha
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  className={ui.input}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Crie uma senha"
                  value={password}
                  aria-invalid={passwordIsInvalid}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.revealButton}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  <Icon name="eye" />
                </button>
              </div>
              <div className={styles.requirements}>
                <p className={styles.requirementsTitle}>Requisitos da senha</p>
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

            <div className={ui.field}>
              <label htmlFor="confirm-password" className={ui.label}>
                Repita a senha
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  className={ui.input}
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Digite sua senha novamente"
                  value={confirmPassword}
                  aria-invalid={confirmPasswordIsInvalid}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.revealButton}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? 'Ocultar confirmação da senha'
                      : 'Mostrar confirmação da senha'
                  }
                  aria-pressed={showConfirmPassword}
                >
                  <Icon name="eye" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`${ui.btn} ${ui.btnPrimary} ${ui.btnBlock} ${styles.mainButton}`}
            >
              {isLoading ? 'Criando conta...' : 'Criar conta'}
              <Icon name="arrow" className={styles.buttonIcon} />
            </button>
          </form>

          <p className={styles.loginLink}>
            Já tem uma conta? <Link href="/login">Fazer login</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
