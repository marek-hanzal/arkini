import { z } from "zod";

export const GameInstantMsSchema = z.number().int().nonnegative();
const GameDurationMsSchema = z.number().int().nonnegative();

const GameTimeWindowSchema = z
	.object({
		startAtMs: GameInstantMsSchema,
		endAtMs: GameInstantMsSchema,
	})
	.strict()
	.refine((value) => value.endAtMs >= value.startAtMs, {
		message: "endAtMs must be >= startAtMs",
		path: [
			"endAtMs",
		],
	});
