import Alpine from "alpinejs";
import { getToken, startPkceFlow } from "@/auth";
import { type AppConfig, loadConfig } from "@/config";

Alpine.data("loginPage", () => ({
	loading: true,
	error: "",
	config: null as AppConfig | null,

	async init() {
		try {
			this.config = await loadConfig();
			if (getToken()) {
				window.location.href = `${this.config.appUrl}/sessions`;
				return;
			}
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load config";
		} finally {
			this.loading = false;
		}
	},

	async login() {
		if (!this.config) return;
		try {
			await startPkceFlow(this.config);
		} catch (e) {
			console.error("Login failed:", e);
			this.error = e instanceof Error ? e.message : "Login failed";
		}
	},
}));

Alpine.start();
