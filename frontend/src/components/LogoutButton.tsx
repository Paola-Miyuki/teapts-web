"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LogoutButtonProps = {
  allSessions?: boolean;
};

export default function LogoutButton({
  allSessions = false,
}: LogoutButtonProps) {
  const router = useRouter();

  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3000";

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(`${apiUrl}/me`, {
          method: "GET",
          credentials: "include",
        });

        setHasSession(response.ok);
      } catch (error) {
        console.error(
          "Erro ao verificar sessão:",
          error
        );

        setHasSession(false);
      } finally {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, [apiUrl]);

  function finishLogout() {
    setHasSession(false);
    setErrorMessage("");

    router.replace("/login");
    router.refresh();
  }

  async function handleLogout() {
    if (!hasSession || loading) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `${apiUrl}/auth/signout`,
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            allSessions,
          }),
        }
      );

      if (response.ok) {
        finishLogout();
        return;
      }

      let data: {
        message?: string;
      } = {};

      try {
        data = await response.json();
      } catch {
        // Resposta sem JSON
      }

      if (
        response.status === 401 ||
        data.message === "unauthorised"
      ) {
        finishLogout();
        return;
      }

      setErrorMessage(
        "Não foi possível encerrar a sessão. Tente novamente."
      );
    } catch (error) {
      console.error(
        "Erro ao realizar logout:",
        error
      );

      setErrorMessage(
        "Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession || !hasSession) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? "Saindo..." : "Sair"}
      </button>

      {errorMessage && (
        <p role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}