'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
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
        router.replace('/home');
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
          <Logo caption="Programa Terapêutico Singular" />
        </div>

        <button type="button" className={styles.helpButton}>
          <Icon name="help" />
          Precisa de ajuda?
        </button>
      </header>

      <main className={styles.main}>
        <section className={styles.login} aria-labelledby="login-title">
          <div className={styles.formWrapper}>
            <h1 id="login-title">Bem-vindo de volta!</h1>

            <p className={styles.intro}>Acesse sua conta TEA-PTS.</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className={`${ui.field} ${styles.field}`}>
                <label htmlFor="email" className={ui.label}>
                  E-mail
                </label>

                <input
                  className={ui.input}
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

                {emailError && <p className={ui.fieldError}>{emailError}</p>}
              </div>

              <div className={`${ui.field} ${styles.field}`}>
                <label htmlFor="password" className={ui.label}>
                  Senha
                </label>

                <div className={styles.passwordWrapper}>
                  <input
                    className={ui.input}
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
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                  </button>
                </div>

                {passwordError && (
                  <p className={ui.fieldError}>{passwordError}</p>
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
                <p className={`${ui.alert} ${styles.loginError}`} role="alert">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className={`${ui.btn} ${ui.btnPrimary} ${ui.btnBlock} ${styles.mainButton}`}
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
              className={`${ui.btn} ${ui.btnSecondary} ${ui.btnBlock} ${styles.mainButton}`}
              onClick={() => router.push('/signup')}
            >
              Criar conta
            </button>

          </div>
        </section>
      </main>

      <footer className={styles.footer}>TEA-PTS</footer>
    </div>
  );
}