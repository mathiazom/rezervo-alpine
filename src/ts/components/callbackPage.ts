import Alpine from "alpinejs";
import { upsertUser } from "@/api";
import { handleCallback } from "@/auth";
import { type AppConfig, loadConfig } from "@/config";

const isSilent = window.parent !== window;

Alpine.data("callbackPage", () => ({
	loading: true,
	error: "",
	config: null as AppConfig | null,

	async init() {
		try {
			this.config = await loadConfig();
			const token = await handleCallback(this.config);

			if (isSilent) {
				// Running inside a hidden iframe — post token to parent, do not navigate
				window.parent.postMessage(
					{ type: "silent-renew-success", token },
					window.location.origin,
				);
				return;
			}

			// Full login flow — register user and redirect
			await upsertUser(this.config.apiUrl, token);
			window.location.href = `${this.config.appUrl}/sessions`;
		} catch (e) {
			if (isSilent) {
				window.parent.postMessage(
					{ type: "silent-renew-failure" },
					window.location.origin,
				);
				return;
			}
			this.error = e instanceof Error ? e.message : "Authentication failed";
			this.loading = false;
		}
	},
}));

Alpine.start();
