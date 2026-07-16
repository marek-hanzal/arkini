import { z } from "zod";
import { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionLineStartSchema = z
	.object({
		inputRefs: z.array(GameActionItemRefSchema),
		itemInstanceId: IdSchema,
		lineId: IdSchema.optional(),
		type: z.literal("line.start"),
	})
	.strict();

export namespace GameActionLineStartSchema {
	export type Type = z.infer<typeof GameActionLineStartSchema>;
}
