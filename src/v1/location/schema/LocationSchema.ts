import { z } from "zod";

import { GridLocationSchema } from "./GridLocationSchema";
import { InputLocationSchema } from "./InputLocationSchema";

/**
 * The concrete runtime or persisted location owned by one live item.
 *
 * Grid locations expose board/inventory coordinates. Input locations keep
 * delivered materials attached to the exact owner line slot that buffers them.
 */
export const LocationSchema = z
	.discriminatedUnion("scope", [
		GridLocationSchema,
		InputLocationSchema,
	])
	.meta({
		id: "LocationSchema",
		description: "The concrete grid or line-input location owned by one live item.",
	});

export type LocationSchema = typeof LocationSchema;

export namespace LocationSchema {
	export type Type = z.infer<LocationSchema>;
}
