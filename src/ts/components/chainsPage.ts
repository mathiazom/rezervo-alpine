import Alpine from "alpinejs";
import { fetchChains } from "@/api";
import { logout, requireAuth } from "@/auth";
import { type AppConfig, loadConfig } from "@/config";
import type { ChainResponse } from "@/schemas/chain";

Alpine.data("chainsPage", () => ({
	loading: true,
	error: "",
	chains: [] as ChainResponse[],
	config: null as AppConfig | null,

	scheduleUrl(chainId: string): string {
		const locations: Record<string, string> = JSON.parse(
			localStorage.getItem("preferredLocations") ?? "{}",
		);
		const loc = locations[chainId];
		return loc
			? `/schedule/${chainId}?location=${loc}`
			: `/schedule/${chainId}`;
	},

	async init() {
		try {
			this.config = await loadConfig();
			await requireAuth();
			this.chains = await fetchChains(this.config.apiUrl);
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load chains";
		} finally {
			this.loading = false;
		}
	},

	logout() {
		void logout();
	},
}));

Alpine.start();
