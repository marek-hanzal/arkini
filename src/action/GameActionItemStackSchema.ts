import { z } from "zod";
import { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionItemStackSchema = z
	.object({
		sourceRef: GameActionItemRefSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("item.stack"),
	})
	.strict();

export namespace GameActionItemStackSchema {
	export type Type = z.infer<typeof GameActionItemStackSchema>;
}
