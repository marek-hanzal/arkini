import { z } from "zod";

export const AppearanceAccentSchema = z
	.enum([
		"rose",
		"violet",
		"blue",
		"green",
		"amber",
	])
	.meta({
		id: "AppearanceAccentSchema",
		description:
			"The explicit Arkini accent palette. Missing or malformed preference data defaults to rose.",
	});

export type AppearanceAccentSchema = typeof AppearanceAccentSchema;

export namespace AppearanceAccentSchema {
	export type Type = z.infer<AppearanceAccentSchema>;
}
