import "dotenv/config";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`RealDoor server listening on http://localhost:${port}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set — extraction endpoints will return 503.");
  }
});
