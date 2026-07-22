import { z } from "zod";

/** The accepted result kind of one product-line start request. */
export const StartLineResultEnumSchema = z
	.enum({
		Started: "started",
		Queued: "queued",
	})
	.meta({
		id: "StartLineResultEnumSchema",
		description: "The accepted result kind of one product-line start request.",
	});

export type StartLineResultEnumSchema = typeof StartLineResultEnumSchema;

export namespace StartLineResultEnumSchema {
	export type Type = z.infer<StartLineResultEnumSchema>;
}
