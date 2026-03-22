import Alpine from "alpinejs";
import { cancelBooking, fetchUserSessions } from "@/api";
import { logout, requireAuth } from "@/auth";
import { type AppConfig, loadConfig } from "@/config";
import type { BaseUserSession } from "@/schemas/session";
import { formatDateKey, formatTime, sessionDateKey } from "@/utils/date";

interface SessionGroup {
	dateKey: string;
	label: string;
	sessions: BaseUserSession[];
}

Alpine.data("sessionsPage", () => ({
	loading: true,
	error: "",
	cancellingId: "" as string,
	sessions: [] as BaseUserSession[],
	config: null as AppConfig | null,
	preferredChain: localStorage.getItem("preferredChain") ?? "",
	preferredChainName: localStorage.getItem("preferredChainName") ?? "",
	preferredChainLogo: localStorage.getItem("preferredChainLogo") ?? "",

	get scheduleUrl(): string {
		if (!this.preferredChain) return "/chains";
		const locations: Record<string, string> = JSON.parse(
			localStorage.getItem("preferredLocations") ?? "{}",
		);
		const loc = locations[this.preferredChain];
		return loc
			? `/schedule/${this.preferredChain}?location=${loc}`
			: `/schedule/${this.preferredChain}`;
	},

	async init() {
		try {
			this.config = await loadConfig();
			const token = await requireAuth(this.config);
			this.sessions = await fetchUserSessions(this.config.apiUrl, token);
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to load sessions";
		} finally {
			this.loading = false;
		}
	},

	get sessionsByDate(): SessionGroup[] {
		const groups = new Map<string, BaseUserSession[]>();
		for (const s of this.sessions) {
			const key = sessionDateKey(s.classData.startTime);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)?.push(s);
		}
		return Array.from(groups.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([dateKey, sessions]) => ({
				dateKey,
				label: formatDateKey(dateKey),
				sessions,
			}));
	},

	formatTime(isoStr: string): string {
		return formatTime(isoStr);
	},

	statusLabel(status: string): string {
		switch (status) {
			case "BOOKED":
				return "Booket";
			case "CONFIRMED":
				return "Bekreftet";
			case "WAITLIST":
				return "Venteliste";
			case "PLANNED":
				return "Planlagt";
			default:
				return status;
		}
	},

	async cancelSession(session: BaseUserSession) {
		if (!this.config || this.cancellingId) return;
		this.cancellingId = session.classData.id;
		try {
			const token = await requireAuth(this.config);
			await cancelBooking(
				this.config.apiUrl,
				session.chain,
				session.classData.id,
				token,
			);
			this.sessions = this.sessions.filter(
				(s) => s.classData.id !== session.classData.id,
			);
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Failed to cancel booking";
		} finally {
			this.cancellingId = "";
		}
	},

	logout() {
		if (this.config) logout(this.config);
	},
}));

Alpine.start();
