import type { RezervoClass } from "../schemas/chain";
import type { ClassBooking } from "../schemas/chainConfig";
import { getOsloParts } from "./date";

// Format: `${activityId}_${weekday}_${hour}_${minute}`
// weekday is 0-indexed Monday (Mon=0, ..., Sun=6)
// Mirrors the existing rezervo-web frontend formula: (luxonWeekday + 6) % 7
// where Luxon weekday is 1-indexed Monday (Mon=1, ..., Sun=7)

function buildRecurrentId(
	activityId: string,
	weekday: number,
	hour: number,
	minute: number,
): string {
	return `${activityId}_${weekday}_${hour}_${minute}`;
}

export function classRecurrentId(cls: RezervoClass): string {
	const { weekday, hour, minute } = getOsloParts(cls.startTime);
	return buildRecurrentId(cls.activity.id, weekday, hour, minute);
}

export function classConfigRecurrentId(booking: ClassBooking): string {
	// booking.weekday is already 0-indexed Monday
	// booking.startTime has { hour, minute }
	return buildRecurrentId(
		booking.activityId,
		booking.weekday,
		booking.startTime.hour,
		booking.startTime.minute,
	);
}

export function classToBookingEntry(cls: RezervoClass): ClassBooking {
	const { weekday, hour, minute } = getOsloParts(cls.startTime);
	return {
		activityId: cls.activity.id,
		weekday,
		locationId: cls.location.id,
		startTime: { hour, minute },
		displayName: cls.activity.name,
	};
}
