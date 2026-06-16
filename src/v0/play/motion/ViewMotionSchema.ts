import { z } from "zod";
import { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";
import { TileExitMotionSchema } from "~/v0/tile-engine/TileExitMotionSchema";

export const ViewMotionSchema = z.object({
	enter: TileEnterMotionSchema.optional(),
	exit: TileExitMotionSchema.optional(),
});

type ViewMotionSchema = typeof ViewMotionSchema;
export namespace ViewMotionSchema {
	export type Type = z.infer<ViewMotionSchema>;
}
