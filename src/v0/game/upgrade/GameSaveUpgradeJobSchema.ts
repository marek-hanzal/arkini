import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameSaveUpgradeJobSchema = z
	.object({
		completesAtMs: NonNegativeIntegerSchema,
		id: IdSchema,
		startedAtMs: NonNegativeIntegerSchema,
		tierIndex: NonNegativeIntegerSchema,
		upgradeId: IdSchema,
	})
	.strict()
	.refine((value) => value.completesAtMs >= value.startedAtMs, {
		message: "completesAtMs must be >= startedAtMs",
		path: [
			"completesAtMs",
		],
	});

export type GameSaveUpgradeJobSchema = typeof GameSaveUpgradeJobSchema;

export namespace GameSaveUpgradeJobSchema {
	export type Type = z.infer<typeof GameSaveUpgradeJobSchema>;
}
