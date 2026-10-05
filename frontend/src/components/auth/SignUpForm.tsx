'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export const SignUpForm: React.FC = () => {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    if (!name.trim()) {
      setGeneralError('O nome é obrigatório.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          formFields: [
            { id: 'name', value: name },
            { id: 'email', value: email },
            { id: 'password', value: password },
          ],
        }),
      });

      const data = await response.json();


      if (!response.ok) {
        setGeneralError(
          Array.isArray(data.message)
            ? data.message[0]
            : data.message || 'Erro ao comunicar com o servidor.'
        );
        return;
      }

      if (data.status === 'OK') {
        router.push('/dashboard');
      } else if (data.status === 'FIELD_ERROR') {
        data.formFields?.forEach((field: { id: string; error: string }) => {
          if (field.id === 'email') {
            setEmailError(field.error);
          }
          if (field.id === 'password') {
            setPasswordError(field.error);
          }
        });
      } else {
        setGeneralError('Ocorreu um erro ao criar a conta. Tente novamente.');
      }
    } catch (error) {
      setGeneralError('Falha de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800 text-white shadow-xl"
    >
      {generalError && (
        <div className="p-3 text-sm bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg">
          {generalError}
        </div>
      )}

      {/* Name Input */}
      <div className="flex flex-col space-y-1 text-left">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          Nome
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />
      </div>

      {/* Email Input */}
      <div className="flex flex-col space-y-1 text-left">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />
        {emailError && (
          <span className="text-xs text-red-400 mt-1">{emailError}</span>
        )}
      </div>

      {/* Password Input */}
      <div className="flex flex-col space-y-1 text-left">
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors pr-16 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {passwordError && (
          <span className="text-xs text-red-400 mt-1">{passwordError}</span>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Criando conta...' : 'Criar conta'}
      </button>

      {/* Login Link */}
      <div className="text-center text-sm text-zinc-400 pt-2">
        <span>Já tem conta? </span>
        <a href="/login" className="text-blue-400 hover:underline">
          Entrar
        </a>
      </div>
    </form>
  );
};