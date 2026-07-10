import { z } from "zod";

import { ResourceSchema } from "./ResourceSchema";

export const PayloadSchema = z
	.object({
		config: z.unknown().describe("The decoded game configuration."),
		resources: z.array(ResourceSchema).describe("The decoded binary resources."),
	})
	.strict()
	.meta({
		id: "PayloadSchema",
		description: "The decoded configuration and binary resources carried by a game pack.",
	});

export type PayloadSchema = typeof PayloadSchema;

export namespace PayloadSchema {
	export type Type = z.infer<PayloadSchema>;
}
