import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Log in — Aureon",
  description: "Sign in to continue your reading.",
};

export default function LoginPage() {
  return <LoginClient />;
}
