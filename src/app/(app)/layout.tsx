import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getLateTaskCount } from "@/lib/data";

/**
 * Telas internas. O proxy já manda quem não está logado para /login;
 * a checagem aqui é a segunda barreira (não dependemos só do proxy).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!(await auth())?.user) redirect("/login");
  return <AppShell atrasadas={await getLateTaskCount()}>{children}</AppShell>;
}
