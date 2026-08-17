import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Aureon",
  description:
    "Free natal chart and numerology to start. Upgrade for unlimited AI conversations, full reports, compatibility analysis, real-time voice calls, and more.",
};

export default function PricingPage() {
  return <PricingClient />;
}
