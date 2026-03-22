import Alpine from "alpinejs";
import { startPkceFlow, tryRefresh } from "@/auth";
import { type AppConfig, loadConfig } from "@/config";

Alpine.data("loginPage", () => ({
	loading: true,
	error: "",
	config: null as AppConfig | null,

	async init() {
		try {
			this.config = await loadConfig();
			// If a valid session exists (refresh token cookie present), skip login
			const token = await tryRefresh();
			if (token) {
				window.location.href = "/sessions";
				return;
			}
		} catch {
			// ignore — show login button
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
