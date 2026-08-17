import type { Metadata } from "next";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "Create your account — Aureon",
  description: "Just an email and password — your profile comes next.",
};

export default function RegisterPage() {
  return <RegisterClient />;
}
