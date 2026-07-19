import { z } from "zod";

export const GameLeaveDestinationSchema = z.discriminatedUnion("destination", [
	z
		.object({
			destination: z.literal("about"),
		})
		.strict(),
	z
		.object({
			destination: z.literal("arkpacks"),
		})
		.strict(),
	z
		.object({
			destination: z.literal("main-menu"),
		})
		.strict(),
	z
		.object({
			destination: z.literal("settings"),
		})
		.strict(),
	z
		.object({
			destination: z.literal("game"),
			packageId: z.string().min(1),
		})
		.strict(),
]);

export type GameLeaveDestinationSchema = typeof GameLeaveDestinationSchema;

export namespace GameLeaveDestinationSchema {
	export type Type = z.infer<GameLeaveDestinationSchema>;
}
