import { z } from "zod";
import { RezervoClassSchema } from "./chain";

export const RezervoDaySchema = z.object({
	dayName: z.string().optional(),
	date: z.string(),
	classes: z.array(RezervoClassSchema),
});

export const RezervoScheduleSchema = z.object({
	locationIds: z.array(z.string()).optional(),
	days: z.array(RezervoDaySchema),
});

export type RezervoDay = z.infer<typeof RezervoDaySchema>;
export type RezervoSchedule = z.infer<typeof RezervoScheduleSchema>;
