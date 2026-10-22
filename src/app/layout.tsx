import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Hub do Caio", template: "%s · Hub do Caio" },
  description: "Carteira de clientes do assessor: patrimônio, evolução, distribuição e tarefas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={urbanist.variable}>
      <body>{children}</body>
    </html>
  );
}
