import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionLineSetDefaultSchema = z
	.object({
		itemInstanceId: IdSchema,
		lineId: IdSchema,
		type: z.literal("line.set_default"),
	})
	.strict();

export namespace GameActionLineSetDefaultSchema {
	export type Type = z.infer<typeof GameActionLineSetDefaultSchema>;
}
