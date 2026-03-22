import { z } from "zod";
import { clearToken } from "./auth";
import { type ChainResponse, ChainResponseSchema } from "./schemas/chain";
import {
	type BaseChainConfig,
	BaseChainConfigSchema,
} from "./schemas/chainConfig";
import {
	type RezervoSchedule,
	RezervoScheduleSchema,
} from "./schemas/schedule";
import { type BaseUserSession, BaseUserSessionSchema } from "./schemas/session";

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(
	apiUrl: string,
	path: string,
	schema: z.ZodType<T>,
	options: RequestInit & { token?: string } = {},
): Promise<T> {
	const { token, ...init } = options;

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(init.headers as Record<string, string>),
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const res = await fetch(`${apiUrl}${path}`, { ...init, headers });

	if (res.status === 401) {
		clearToken();
		window.location.href = "/login";
		return new Promise(() => {});
	}

	if (!res.ok) {
		throw new Error(`API error ${res.status}: ${path}`);
	}

	const json = await res.json();
	return schema.parse(json);
}

// ── Public API functions ──────────────────────────────────────────────────────

export async function fetchChains(apiUrl: string): Promise<ChainResponse[]> {
	return apiFetch(apiUrl, "/chains", z.array(ChainResponseSchema));
}

export async function fetchWeekSchedule(
	apiUrl: string,
	chain: string,
	compactIsoWeek: string,
	locationIds: string[] = [],
): Promise<RezervoSchedule> {
	const params =
		locationIds.length > 0
			? "?" +
				locationIds.map((id) => `location=${encodeURIComponent(id)}`).join("&")
			: "";
	return apiFetch(
		apiUrl,
		`/schedule/${chain}/${compactIsoWeek}${params}`,
		RezervoScheduleSchema,
	);
}

export async function fetchUserSessions(
	apiUrl: string,
	token: string,
): Promise<BaseUserSession[]> {
	return apiFetch(apiUrl, "/user/sessions", z.array(BaseUserSessionSchema), {
		token,
	});
}

export async function fetchChainConfig(
	apiUrl: string,
	chain: string,
	token: string,
): Promise<BaseChainConfig> {
	return apiFetch(apiUrl, `/${chain}/config`, BaseChainConfigSchema, { token });
}

export async function putChainConfig(
	apiUrl: string,
	chain: string,
	config: BaseChainConfig,
	token: string,
): Promise<BaseChainConfig> {
	return apiFetch(apiUrl, `/${chain}/config`, BaseChainConfigSchema, {
		method: "PUT",
		body: JSON.stringify(config),
		token,
	});
}

export async function cancelBooking(
	apiUrl: string,
	chain: string,
	classId: string,
	token: string,
): Promise<void> {
	const res = await fetch(`${apiUrl}/${chain}/cancel-booking`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ classId }),
	});

	if (res.status === 401) {
		clearToken();
		window.location.href = "/login";
		return;
	}

	if (!res.ok) {
		throw new Error(`Cancel booking failed: ${res.status}`);
	}
}

export async function upsertUser(
	apiUrl: string,
	token: string,
): Promise<{ id: string; name: string }> {
	return apiFetch(
		apiUrl,
		"/user",
		z.object({ id: z.string(), name: z.string() }),
		{ method: "PUT", token },
	);
}
