import Alpine from "alpinejs";
import { upsertUser } from "@/api";
import { handleCallback } from "@/auth";
import { loadConfig } from "@/config";

Alpine.data("callbackPage", () => ({
	loading: true,
	error: "",

	async init() {
		try {
			const config = await loadConfig();
			const token = await handleCallback();
			await upsertUser(config.apiUrl, token);
			window.location.href = "/sessions";
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Authentication failed";
			this.loading = false;
		}
	},
}));

Alpine.start();
