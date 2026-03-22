import { z } from "zod";

export const SessionStateSchema = z.enum([
	"CONFIRMED",
	"BOOKED",
	"WAITLIST",
	"PLANNED",
	"NOSHOW",
	"UNKNOWN",
]);

export type SessionState = z.infer<typeof SessionStateSchema>;

const SessionRezervoClassSchema = z.object({
	id: z.string(),
	startTime: z.string(),
	endTime: z.string(),
	location: z.object({
		id: z.string(),
		studio: z.string(),
		room: z.string().nullable().optional(),
	}),
	activity: z.object({
		id: z.string(),
		name: z.string(),
		category: z.string(),
		color: z.string(),
		image: z.string().nullable().optional(),
	}),
	instructors: z.array(z.object({ name: z.string() })),
});

export const BaseUserSessionSchema = z.object({
	chain: z.string(),
	status: SessionStateSchema,
	positionInWaitList: z.number().nullable().optional(),
	classData: SessionRezervoClassSchema,
});

export type BaseUserSession = z.infer<typeof BaseUserSessionSchema>;
