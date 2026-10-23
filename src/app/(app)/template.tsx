import type { ReactNode } from "react";

/**
 * O template é recriado a cada navegação (o layout não), então as animações
 * de entrada (.rv, .ln) da página rodam de novo toda vez que se troca de tela.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div style={{ display: "contents" }}>{children}</div>;
}
