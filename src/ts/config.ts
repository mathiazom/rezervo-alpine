import { z } from "zod";

const AppConfigSchema = z.object({
	fusionAuthUrl: z.string().url(),
	fusionAuthClientId: z.string(),
	appUrl: z.string().url(),
	apiUrl: z.string().url(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

let cached: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
	if (cached) return cached;
	const res = await fetch("/config.json", { cache: "no-store" });
	if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
	const json = await res.json();
	cached = AppConfigSchema.parse(json);
	return cached;
}
