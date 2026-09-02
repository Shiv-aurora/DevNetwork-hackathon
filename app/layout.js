import "./globals.css";
import "./product.css";
import ProductShell from "../components/ProductShell";

export const metadata = {
  title: "ProofRoot — Agent Accountability",
  description: "The flight recorder for autonomous AI agents.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><ProductShell>{children}</ProductShell></body>
    </html>
  );
}
