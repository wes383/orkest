import { initializePaddle, Paddle } from "@paddle/paddle-js";

let paddleInstance: Paddle | null = null;

export async function getPaddle(): Promise<Paddle | null> {
  if (paddleInstance) {
    return paddleInstance;
  }

  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment = (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "sandbox";

  if (!token) {
    console.error("Paddle Client Token is missing from environment variables.");
    return null;
  }

  try {
    const initializedPaddle = await initializePaddle({
      token,
      environment,
    });

    if (initializedPaddle) {
      paddleInstance = initializedPaddle;
      return paddleInstance;
    }
  } catch (error) {
    console.error("Failed to initialize Paddle:", error);
  }

  return null;
}
