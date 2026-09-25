import { z } from "zod";

/** The concrete ownership scope of one live runtime-item location. */
export const LocationScopeEnumSchema = z
	.enum({
		Board: "board",
		Terminal: "terminal",
		Input: "input",
		Job: "job",
		Reserved: "reserved",
		Delivery: "delivery",
	})
	.meta({
		id: "LocationScopeEnumSchema",
		description: "The concrete ownership scope of one live runtime-item location.",
	});

export type LocationScopeEnumSchema = typeof LocationScopeEnumSchema;

export namespace LocationScopeEnumSchema {
	export type Type = z.infer<LocationScopeEnumSchema>;
}
