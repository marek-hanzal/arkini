import { z } from "zod";

/** The concrete ownership scope of one live runtime-item location. */
export const LocationScopeEnumSchema = z
	.enum({
		Board: "board",
		Inventory: "inventory",
		Toolbar: "toolbar",
		Input: "input",
		Job: "job",
		Reserved: "reserved",
	})
	.meta({
		id: "LocationScopeEnumSchema",
		description: "The concrete ownership scope of one live runtime-item location.",
	});

export type LocationScopeEnumSchema = typeof LocationScopeEnumSchema;

export namespace LocationScopeEnumSchema {
	export type Type = z.infer<LocationScopeEnumSchema>;
}
