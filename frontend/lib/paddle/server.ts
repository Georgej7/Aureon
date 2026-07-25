import { Environment, Paddle } from "@paddle/paddle-node-sdk";

// Server-only — PADDLE_API_KEY has no NEXT_PUBLIC_ prefix, so Next.js never
// bundles it into client-side JS. Only import this file from API routes.
let paddleClient: Paddle | null = null;

export function getPaddleClient(): Paddle {
  if (!paddleClient) {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      throw new Error("PADDLE_API_KEY is not set");
    }
    const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? Environment.production : Environment.sandbox;
    paddleClient = new Paddle(apiKey, { environment });
  }
  return paddleClient;
}
