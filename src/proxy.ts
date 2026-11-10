import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Redirecionamento otimista das páginas: sem sessão vai para /login, com sessão
 * não fica no /login. A API não passa por aqui (cada rota exige sessão via
 * protectedRoute) e o layout das telas internas confere a sessão de novo.
 */
export default auth((req) => {
  const logado = Boolean(req.auth?.user);
  const naLogin = req.nextUrl.pathname === "/login";

  if (!logado && !naLogin) return NextResponse.redirect(new URL("/login", req.nextUrl));
  if (logado && naLogin) return NextResponse.redirect(new URL("/", req.nextUrl));
});

export const config = {
  // tudo menos a API, os arquivos do Next, arquivos com extensão (favicon, imagens…)
  // e a /sinuca, que é pública de propósito (jogo escondido, sem dados de clientes)
  matcher: ["/((?!api|sinuca$|_next/static|_next/image|.*\\..*).*)"],
};
