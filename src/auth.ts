import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Usado quando o e-mail não confere, para o tempo de resposta não revelar se o e-mail existe.
const DUMMY_HASH = bcrypt.hashSync("senha-descartavel", 10);

/**
 * Login de usuário único (o Caio), configurado por variáveis de ambiente:
 * ADMIN_EMAIL e ADMIN_PASSWORD_HASH (bcrypt; gere com `npm run hash-password`).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        // Aceita o hash com as barras do .env.local (`\$2b\$...`) caso alguém o cole assim na Vercel;
        // um hash bcrypt nunca contém `\`, `"`, `'` nem espaços.
        const adminHash = process.env.ADMIN_PASSWORD_HASH?.replace(/[\\"'\s]/g, "");
        if (!adminEmail || !adminHash || !password) return null;

        const passwordOk = await bcrypt.compare(password, email === adminEmail ? adminHash : DUMMY_HASH);
        if (email !== adminEmail || !passwordOk) return null;
        return { id: "admin", email: adminEmail };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
});
