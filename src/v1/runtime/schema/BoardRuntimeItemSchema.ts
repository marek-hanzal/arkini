import { z } from "zod";

import { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** One live runtime item currently placed on the board. */
export const BoardRuntimeItemSchema = RuntimeItemSchema.extend({
	location: BoardLocationSchema,
}).meta({
	id: "BoardRuntimeItemSchema",
	description: "One live runtime item currently placed on the board.",
});

export type BoardRuntimeItemSchema = typeof BoardRuntimeItemSchema;

export namespace BoardRuntimeItemSchema {
	export type Type = z.infer<BoardRuntimeItemSchema>;
}
