import "dotenv/config";
import { createApp } from "./app.ts";
import { provider } from "./extraction/provider.ts";
import { rulesProvider } from "./rules/provider.ts";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`RealDoor server listening on http://localhost:${port} (extraction: ${provider.name})`);
  if (!provider.isConfigured()) {
    console.warn(`Extraction not configured — endpoints will return 503. ${provider.configurationHint}`);
  }
  if (!rulesProvider.isConfigured()) {
    console.warn("Rules Q&A not configured — /rules/ask will return 503. Set OPENAI_API_KEY.");
  }
});
