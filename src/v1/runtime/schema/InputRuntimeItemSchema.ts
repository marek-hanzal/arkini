import { z } from "zod";

import { InputLocationSchema } from "~/v1/location/schema/InputLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * One live runtime material currently buffered by a product-line input.
 */
export const InputRuntimeItemSchema = RuntimeItemSchema.extend({
	location: InputLocationSchema,
}).meta({
	id: "InputRuntimeItemSchema",
	description: "One live runtime material buffered by a concrete product-line input.",
});

export type InputRuntimeItemSchema = typeof InputRuntimeItemSchema;

export namespace InputRuntimeItemSchema {
	export type Type = z.infer<InputRuntimeItemSchema>;
}
