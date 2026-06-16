import { z } from "zod";
import { TileEnterMotionSchema } from "~/v0/tile-engine/TileEnterMotionSchema";

export const ViewMotionSchema = z.object({
	enter: TileEnterMotionSchema.optional(),
});

type ViewMotionSchema = typeof ViewMotionSchema;
export namespace ViewMotionSchema {
	export type Type = z.infer<ViewMotionSchema>;
}
