import { z } from "zod";

export const RezervoInstructorSchema = z.object({
	name: z.string(),
});

export const RezervoLocationSchema = z.object({
	id: z.string(),
	studio: z.string(),
	room: z.string().nullable().optional(),
});

export const RezervoActivitySchema = z.object({
	id: z.string(),
	name: z.string(),
	category: z.string(),
	description: z.string().nullable().optional(),
	additionalInformation: z.string().nullable().optional(),
	color: z.string(),
	image: z.string().nullable().optional(),
});

export const RezervoClassSchema = z.object({
	id: z.string(),
	startTime: z.string(),
	endTime: z.string(),
	location: RezervoLocationSchema,
	activity: RezervoActivitySchema,
	instructors: z.array(RezervoInstructorSchema),
	isBookable: z.boolean(),
	isCancelled: z.boolean(),
	cancelText: z.string().nullable().optional(),
	totalSlots: z.number().nullable().optional(),
	availableSlots: z.number().nullable().optional(),
	waitingListCount: z.number().nullable().optional(),
	userStatus: z.string().nullable().optional(),
	bookingOpensAt: z.string(),
});

export type RezervoClass = z.infer<typeof RezervoClassSchema>;
export type RezervoActivity = z.infer<typeof RezervoActivitySchema>;
export type RezervoLocation = z.infer<typeof RezervoLocationSchema>;

const BaseLocationSchema = z.object({
	identifier: z.string(),
	name: z.string(),
});

const BranchProfileSchema = z.object({
	identifier: z.string(),
	name: z.string(),
	locations: z.array(BaseLocationSchema),
});

const ThemeSpecificImagesSchema = z.object({
	largeLogo: z.string(),
});

const ThemeAgnosticImagesSchema = z.object({
	smallLogo: z.string(),
});

const ChainProfileImagesSchema = z.object({
	light: ThemeSpecificImagesSchema,
	dark: ThemeSpecificImagesSchema,
	common: ThemeAgnosticImagesSchema,
});

const ChainProfileSchema = z.object({
	identifier: z.string(),
	name: z.string(),
	images: ChainProfileImagesSchema,
});

export const ChainResponseSchema = z.object({
	profile: ChainProfileSchema,
	branches: z.array(BranchProfileSchema),
});

export type ChainResponse = z.infer<typeof ChainResponseSchema>;
export type BranchProfile = z.infer<typeof BranchProfileSchema>;
export type BaseLocation = z.infer<typeof BaseLocationSchema>;
