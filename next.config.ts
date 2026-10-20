import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs usa APIs de Node; não deve ser empacotado.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
