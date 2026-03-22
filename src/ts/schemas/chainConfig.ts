import { z } from "zod";

export const ClassTimeSchema = z.object({
	hour: z.number(),
	minute: z.number(),
});

export const ClassBookingSchema = z.object({
	activityId: z.string(),
	weekday: z.number(),
	locationId: z.string(),
	startTime: ClassTimeSchema,
	displayName: z.string(),
});

export const BaseChainConfigSchema = z.object({
	active: z.boolean(),
	recurringBookings: z.array(ClassBookingSchema),
});

export type ClassTime = z.infer<typeof ClassTimeSchema>;
export type ClassBooking = z.infer<typeof ClassBookingSchema>;
export type BaseChainConfig = z.infer<typeof BaseChainConfigSchema>;
