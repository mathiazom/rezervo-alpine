import Alpine from "alpinejs";
import {
	fetchChainConfig,
	fetchChains,
	fetchWeekSchedule,
	putChainConfig,
} from "@/api";
import { logout, requireAuth } from "@/auth";
import { type AppConfig, loadConfig } from "@/config";
import type { ChainResponse, RezervoClass } from "@/schemas/chain";
import type { BaseChainConfig } from "@/schemas/chainConfig";
import type { RezervoDay } from "@/schemas/schedule";
import {
	currentCompactIsoWeek,
	formatTime,
	formatWeekLabel,
	isInPast,
	offsetCompactIsoWeek,
} from "@/utils/date";
import {
	classConfigRecurrentId,
	classRecurrentId,
	classToBookingEntry,
} from "@/utils/recurrentId";

Alpine.data("schedulePage", () => ({
	loading: true,
	error: "",
	savingConfig: false,
	chain: "",
	chainData: null as ChainResponse | null,
	currentWeek: "",
	selectedLocationId: "",
	days: [] as RezervoDay[],
	config: null as BaseChainConfig | null,
	pendingConfig: null as BaseChainConfig | null,
	config_load_error: false,
	config_unavailable: false,
	token: "",
	config_obj: null as AppConfig | null,

	async init() {
		// Extract chain from URL path: /schedule/<chain>
		const pathParts = window.location.pathname.split("/");
		this.chain = pathParts[pathParts.length - 1] ?? "";

		if (!this.chain) {
			this.error = "No chain specified in URL";
			this.loading = false;
			return;
		}

		localStorage.setItem("preferredChain", this.chain);
		const params = new URLSearchParams(window.location.search);
		this.currentWeek = params.get("week") ?? currentCompactIsoWeek();
		this.selectedLocationId =
			params.get("location") ?? this.getSavedLocation() ?? "";

		document.addEventListener("keydown", (e) => {
			const typing =
				document.activeElement instanceof HTMLInputElement ||
				document.activeElement instanceof HTMLTextAreaElement;
			if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key === "s" && this.configDirty && !this.savingConfig)
				this.saveConfig();
			if (e.key === "Escape" && this.configDirty) this.discardConfig();
		});

		try {
			this.config_obj = await loadConfig();
			this.token = await requireAuth(this.config_obj);

			if (this.selectedLocationId) {
				// Location known — fire all three requests in parallel
				this.syncLocationUrl();
				const [chains, chainConfig, schedule] = await Promise.allSettled([
					fetchChains(this.config_obj.apiUrl),
					fetchChainConfig(this.config_obj.apiUrl, this.chain, this.token),
					fetchWeekSchedule(
						this.config_obj.apiUrl,
						this.chain,
						this.currentWeek,
						[this.selectedLocationId],
					),
				]);

				if (chains.status === "fulfilled") {
					this.chainData =
						chains.value.find((c) => c.profile.identifier === this.chain) ??
						null;
					this.persistChainMeta();
				}
				if (chainConfig.status === "fulfilled") {
					this.config = chainConfig.value;
					this.pendingConfig = JSON.parse(JSON.stringify(chainConfig.value));
				} else {
					this.config_unavailable = true;
					this.config = { active: true, recurringBookings: [] };
					this.pendingConfig = { active: true, recurringBookings: [] };
				}
				if (schedule.status === "fulfilled") {
					this.days = schedule.value.days;
				} else {
					this.error =
						(schedule.reason as Error)?.message ?? "Failed to load schedule";
				}
			} else {
				// No location yet — need chain data first to pick the default
				const [chains, chainConfig] = await Promise.allSettled([
					fetchChains(this.config_obj.apiUrl),
					fetchChainConfig(this.config_obj.apiUrl, this.chain, this.token),
				]);

				if (chains.status === "fulfilled") {
					this.chainData =
						chains.value.find((c) => c.profile.identifier === this.chain) ??
						null;
					if (this.chainData) {
						this.selectedLocationId =
							this.chainData.branches[0]?.locations[0]?.identifier ?? "";
						this.persistChainMeta();
					}
				}
				if (chainConfig.status === "fulfilled") {
					this.config = chainConfig.value;
					this.pendingConfig = JSON.parse(JSON.stringify(chainConfig.value));
				} else {
					this.config_unavailable = true;
					this.config = { active: true, recurringBookings: [] };
					this.pendingConfig = { active: true, recurringBookings: [] };
				}

				await this.loadSchedule();
			}
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load schedule";
		} finally {
			this.loading = false;
		}
	},

	get configDirty(): boolean {
		return JSON.stringify(this.pendingConfig) !== JSON.stringify(this.config);
	},

	get locations() {
		if (!this.chainData) return [];
		return this.chainData.branches.flatMap((b) => b.locations);
	},

	getSavedLocation(): string | null {
		try {
			const map = JSON.parse(
				localStorage.getItem("preferredLocations") ?? "{}",
			);
			return map[this.chain] ?? null;
		} catch {
			return null;
		}
	},

	saveLocation() {
		if (!this.selectedLocationId) return;
		try {
			const map = JSON.parse(
				localStorage.getItem("preferredLocations") ?? "{}",
			);
			map[this.chain] = this.selectedLocationId;
			localStorage.setItem("preferredLocations", JSON.stringify(map));
		} catch {}
	},

	persistChainMeta() {
		if (!this.chainData || !this.config_obj) return;
		const base = `${this.config_obj.apiUrl}/`;
		localStorage.setItem("preferredChainName", this.chainData.profile.name);
		localStorage.setItem(
			"preferredChainLogoDark",
			base + this.chainData.profile.images.dark.largeLogo,
		);
		localStorage.setItem(
			"preferredChainLogoLight",
			base + this.chainData.profile.images.light.largeLogo,
		);
	},

	get chainLogoUrlDark(): string {
		if (!this.chainData || !this.config_obj) return "";
		return `${this.config_obj.apiUrl}/${this.chainData.profile.images.dark.largeLogo}`;
	},

	get chainLogoUrlLight(): string {
		if (!this.chainData || !this.config_obj) return "";
		return `${this.config_obj.apiUrl}/${this.chainData.profile.images.light.largeLogo}`;
	},

	syncLocationUrl() {
		const params = new URLSearchParams(window.location.search);
		if (this.selectedLocationId) {
			params.set("location", this.selectedLocationId);
			this.saveLocation();
		} else {
			params.delete("location");
		}
		const currentIsoWeek = currentCompactIsoWeek();
		if (this.currentWeek && this.currentWeek !== currentIsoWeek) {
			params.set("week", this.currentWeek);
		} else {
			params.delete("week");
		}
		const newSearch = params.toString();
		history.replaceState(
			null,
			"",
			window.location.pathname + (newSearch ? `?${newSearch}` : ""),
		);
	},

	async loadSchedule() {
		if (!this.config_obj) return;
		this.loading = true;
		this.error = "";
		this.syncLocationUrl();
		try {
			const locationIds = this.selectedLocationId
				? [this.selectedLocationId]
				: [];
			const schedule = await fetchWeekSchedule(
				this.config_obj.apiUrl,
				this.chain,
				this.currentWeek,
				locationIds,
			);
			this.days = schedule.days;
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load schedule";
		} finally {
			this.loading = false;
		}
	},

	async navigateWeek(offset: number) {
		this.currentWeek = offsetCompactIsoWeek(this.currentWeek, offset);
		await this.loadSchedule();
	},

	get weekLabel(): string {
		return formatWeekLabel(this.currentWeek);
	},

	formatTime(isoStr: string): string {
		return formatTime(isoStr);
	},

	isInPast(isoStr: string): boolean {
		return isInPast(isoStr);
	},

	isClassInConfig(cls: RezervoClass): boolean {
		if (!this.pendingConfig) return false;
		const id = classRecurrentId(cls);
		return this.pendingConfig.recurringBookings.some(
			(b) => classConfigRecurrentId(b) === id,
		);
	},

	toggleClass(cls: RezervoClass) {
		if (!this.pendingConfig) return;
		const id = classRecurrentId(cls);
		const idx = this.pendingConfig.recurringBookings.findIndex(
			(b) => classConfigRecurrentId(b) === id,
		);
		if (idx >= 0) {
			this.pendingConfig.recurringBookings.splice(idx, 1);
		} else {
			this.pendingConfig.recurringBookings.push(classToBookingEntry(cls));
		}
	},

	async saveConfig() {
		if (!this.config_obj || !this.pendingConfig || this.savingConfig) return;
		this.savingConfig = true;
		try {
			const token = await requireAuth(this.config_obj);
			const saved = await putChainConfig(
				this.config_obj.apiUrl,
				this.chain,
				this.pendingConfig,
				token,
			);
			this.config = saved;
			this.pendingConfig = JSON.parse(JSON.stringify(saved));
			this.config_unavailable = false;
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to save config";
		} finally {
			this.savingConfig = false;
		}
	},

	discardConfig() {
		this.pendingConfig = JSON.parse(JSON.stringify(this.config));
	},

	logout() {
		if (this.config_obj) logout(this.config_obj);
	},
}));

Alpine.start();
