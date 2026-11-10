import type { Metadata } from "next";
import { SinucaGame } from "./sinuca-game";

// Página escondida: sem link no menu, sem login e fora dos buscadores.
export const metadata: Metadata = {
  title: "Sinuca",
  robots: { index: false, follow: false },
};

export default function SinucaPage() {
  return <SinucaGame />;
}
