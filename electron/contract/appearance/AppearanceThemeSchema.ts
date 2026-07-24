import { z } from "zod";

export const AppearanceThemeSchema = z
	.enum([
		"dark",
		"light",
		"system",
	])
	.meta({
		id: "AppearanceThemeSchema",
		description:
			"The explicit Arkini appearance preference. Missing preference data defaults to dark; system is selected only by the user.",
	});

export type AppearanceThemeSchema = typeof AppearanceThemeSchema;

export namespace AppearanceThemeSchema {
	export type Type = z.infer<AppearanceThemeSchema>;
}
