const OSLO_TZ = "Europe/Oslo";

// ── Internal helpers ──────────────────────────────────────────────────────────

function getOsloDateParts(date: Date): {
	year: number;
	month: number;
	day: number;
} {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: OSLO_TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	const get = (type: string) =>
		parseInt(parts.find((p) => p.type === type)?.value ?? "", 10);

	return { year: get("year"), month: get("month"), day: get("day") };
}

function isoWeekFromYearMonthDay(
	year: number,
	month: number,
	day: number,
): { isoYear: number; week: number } {
	// Compute ISO week number for a given calendar date.
	// ISO week: Monday is first day of week, week 1 contains the first Thursday.
	const d = new Date(Date.UTC(year, month - 1, day));
	const dayOfWeek = d.getUTCDay() || 7; // 1=Mon ... 7=Sun
	// Set to nearest Thursday: current date + 4 - current day of week
	d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(
		((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
	return { isoYear: d.getUTCFullYear(), week };
}

// ── Compact ISO week: "YYYYWww" ───────────────────────────────────────────────

export function currentCompactIsoWeek(): string {
	const { year, month, day } = getOsloDateParts(new Date());
	const { isoYear, week } = isoWeekFromYearMonthDay(year, month, day);
	return `${isoYear}W${String(week).padStart(2, "0")}`;
}

export function offsetCompactIsoWeek(
	compactWeek: string,
	offset: number,
): string {
	if (offset === 0) return compactWeek;

	const isoYear = parseInt(compactWeek.slice(0, 4), 10);
	const weekNum = parseInt(compactWeek.slice(5, 7), 10);

	// Find the Monday of the given ISO week.
	// Jan 4 is always in ISO week 1.
	const jan4 = new Date(Date.UTC(isoYear, 0, 4));
	const jan4DayOfWeek = jan4.getUTCDay() || 7; // 1=Mon
	// Monday of week 1:
	const mondayOfWeek1 = new Date(jan4);
	mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4DayOfWeek - 1));
	// Monday of target week:
	const mondayOfTargetWeek = new Date(mondayOfWeek1);
	mondayOfTargetWeek.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNum - 1) * 7);
	// Apply offset:
	mondayOfTargetWeek.setUTCDate(mondayOfTargetWeek.getUTCDate() + offset * 7);

	const y = mondayOfTargetWeek.getUTCFullYear();
	const m = mondayOfTargetWeek.getUTCMonth() + 1;
	const d = mondayOfTargetWeek.getUTCDate();
	const { isoYear: newIsoYear, week: newWeek } = isoWeekFromYearMonthDay(
		y,
		m,
		d,
	);
	return `${newIsoYear}W${String(newWeek).padStart(2, "0")}`;
}

// ── Oslo timezone date/time extraction ───────────────────────────────────────

export function getOsloParts(isoStr: string): {
	weekday: number; // 0=Mon, 1=Tue, ..., 6=Sun
	hour: number;
	minute: number;
} {
	const date = new Date(isoStr);
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: OSLO_TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const get = (type: string) =>
		parseInt(parts.find((p) => p.type === type)?.value ?? "", 10);

	const year = get("year");
	const month = get("month");
	const day = get("day");
	let hour = get("hour");
	const minute = get("minute");

	// Intl hour12:false can return 24 for midnight in some environments
	if (hour === 24) hour = 0;

	// Get weekday from the Oslo calendar date
	const d = new Date(Date.UTC(year, month - 1, day));
	const jsDay = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
	const weekday = (jsDay + 6) % 7; // 0=Mon, ..., 6=Sun

	return { weekday, hour, minute };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function formatSessionDate(isoStr: string): string {
	return new Intl.DateTimeFormat("nb-NO", {
		timeZone: OSLO_TZ,
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date(isoStr));
}

export function formatTime(isoStr: string): string {
	return new Intl.DateTimeFormat("nb-NO", {
		timeZone: OSLO_TZ,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(isoStr));
}

export function formatWeekLabel(compactWeek: string): string {
	// Parse "YYYYWww" and return a human-readable label like "Uke 12, 2026"
	const isoYear = parseInt(compactWeek.slice(0, 4), 10);
	const weekNum = parseInt(compactWeek.slice(5, 7), 10);
	return `Uke ${weekNum}, ${isoYear}`;
}

export function isInPast(isoStr: string): boolean {
	return new Date(isoStr) < new Date();
}

export function sessionDateKey(isoStr: string): string {
	// Returns "YYYY-MM-DD" in Oslo timezone for grouping sessions by date
	const { year, month, day } = getOsloDateParts(new Date(isoStr));
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateKey(dateKey: string): string {
	// Format "YYYY-MM-DD" as a readable date
	return new Intl.DateTimeFormat("nb-NO", {
		timeZone: OSLO_TZ,
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date(`${dateKey}T12:00:00Z`));
}
