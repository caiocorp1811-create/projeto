"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { erro: string; email: string; tentativa: number } | undefined;

/** Server Action do formulário de login (usada com useActionState). */
export async function login(prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return {
        erro:
          e.type === "CredentialsSignin"
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar agora. Tente de novo.",
        email,
        tentativa: (prev?.tentativa ?? 0) + 1,
      };
    }
    // o login certo termina num redirect, que o Next entrega como exceção
    throw e;
  }
  return undefined;
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
