'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

import { initSuperTokens } from '@/lib/supertokens';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initSuperTokens();
  }, []);

  function validateEmail() {
    const value = email.trim();

    if (!value) {
      setEmailError('Informe seu e-mail.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value)) {
      setEmailError('Informe um e-mail válido, como nome@exemplo.com.');

      return false;
    }

    setEmailError('');
    return true;
  }

  function validatePassword() {
    if (!password.trim()) {
      setPasswordError('Informe sua senha.');
      return false;
    }

    setPasswordError('');
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoginError('');

    const emailIsValid = validateEmail();
    const passwordIsValid = validatePassword();

    if (!emailIsValid || !passwordIsValid) {
      return;
    }

    setLoading(true);

    try {
      const response = await EmailPassword.signIn({
        formFields: [
          {
            id: 'email',
            value: email.trim(),
          },
          {
            id: 'password',
            value: password,
          },
        ],
      });

      if (response.status === 'OK') {
        router.replace('/');
        return;
      }

      if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        setLoginError('E-mail ou senha inválidos.');

        return;
      }

      setLoginError('Não foi possível concluir a autenticação.');
    } catch (error) {
      console.error('Erro ao realizar login:', error);

      setLoginError('Não foi possível concluir a autenticação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>TEA</div>

          <div>
            <div className={styles.brandName}>TEA-PTS</div>

            <span className={styles.brandCaption}>
              Programa Terapêutico Singular
            </span>
          </div>
        </div>

        <button type="button" className={styles.helpButton}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />

            <path d="M9.6 9a2.4 2.4 0 0 1 4.8 0c0 2-2.4 2-2.4 4M12 16v1" />
          </svg>
          Precisa de ajuda?
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.login} aria-labelledby="login-title">
          <div className={styles.formWrapper}>
            <h1 id="login-title">Bem-vindo de volta!</h1>

            <p className={styles.intro}>Acesse sua conta TEA-PTS.</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="email">E-mail</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="Digite seu e-mail"
                  value={email}
                  disabled={loading}
                  aria-invalid={emailError ? 'true' : 'false'}
                  onChange={(event) => {
                    setEmail(event.target.value);

                    if (emailError) {
                      setEmailError('');
                    }

                    if (loginError) {
                      setLoginError('');
                    }
                  }}
                />

                {emailError && (
                  <p className={styles.fieldError}>{emailError}</p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Senha</label>

                <div className={styles.passwordWrapper}>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    disabled={loading}
                    aria-invalid={passwordError ? 'true' : 'false'}
                    onChange={(event) => {
                      setPassword(event.target.value);

                      if (passwordError) {
                        setPasswordError('');
                      }

                      if (loginError) {
                        setLoginError('');
                      }
                    }}
                  />

                  <button
                    type="button"
                    className={styles.revealButton}
                    aria-label={
                      showPassword ? 'Ocultar senha' : 'Mostrar senha'
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />

                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                </div>

                {passwordError && (
                  <p className={styles.fieldError}>{passwordError}</p>
                )}
              </div>

              <div className={styles.options}>
                <label className={styles.remember}>
                  <input type="checkbox" disabled={loading} />
                  Lembrar meu e-mail
                </label>

                <button type="button" className={styles.textButton}>
                  Esqueci minha senha
                </button>
              </div>

              {loginError && (
                <p className={styles.loginError} role="alert">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className={styles.divider}>
              <span>Ainda não tem uma conta?</span>
            </div>

            <button
              type="button"
              className={styles.signupButton}
              onClick={() => router.push('/cadastro')}
            >
              Criar conta
            </button>

            <p className={styles.secure}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="6" y="10" width="12" height="10" rx="2" />

                <path d="M9 10V7a3 3 0 0 1 6 0v3" />

                <path d="M12 14v2" />
              </svg>

              <span>
                Seu acesso respeita as permissões da sua conta.
                <br />
                Informações de saúde exigem cuidado e privacidade.
              </span>
            </p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>TEA-PTS</footer>
    </div>
  );
}
