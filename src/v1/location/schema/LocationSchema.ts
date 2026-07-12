import { z } from "zod";

import { GridLocationSchema } from "./GridLocationSchema";
import { InputLocationSchema } from "./InputLocationSchema";
import { JobLocationSchema } from "./JobLocationSchema";

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
		JobLocationSchema,
	])
	.meta({
		id: "LocationSchema",
		description:
			"The concrete grid, line-input, or active-job location owned by one live item.",
	});

export type LocationSchema = typeof LocationSchema;

export namespace LocationSchema {
	export type Type = z.infer<LocationSchema>;
}
