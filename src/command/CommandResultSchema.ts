import { z } from "zod";
import { CommandVisualEventSchema } from "./CommandVisualEventSchema";

export const CommandResultSchema = z.object({
	visualEvents: z.array(CommandVisualEventSchema),
});

type CommandResultSchema = typeof CommandResultSchema;
export namespace CommandResultSchema {
	export type Type = z.infer<CommandResultSchema>;
}
