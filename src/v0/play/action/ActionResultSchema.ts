import { z } from "zod";
import { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export const ActionResultSchema = z.object({
	visualEvents: z.array(ActionVisualEventSchema),
});

type ActionResultSchema = typeof ActionResultSchema;
export namespace ActionResultSchema {
	export type Type = z.infer<ActionResultSchema>;
}
