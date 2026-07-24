import { z } from "zod";

export const CheatAvailabilitySchema = z.boolean().meta({
	id: "CheatAvailabilitySchema",
	description:
		"The application-wide preference that exposes save-scoped cheat tooling without enabling cheats in any Game.",
});

export type CheatAvailabilitySchema = typeof CheatAvailabilitySchema;

export namespace CheatAvailabilitySchema {
	export type Type = z.infer<CheatAvailabilitySchema>;
}
