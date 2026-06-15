import { z } from "zod";

export const ItemInstanceIdSchema = z.string().min(1);

type ItemInstanceIdSchema = typeof ItemInstanceIdSchema;
export namespace ItemInstanceIdSchema {
	export type Type = z.infer<ItemInstanceIdSchema>;
}
