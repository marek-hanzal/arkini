import { z } from "zod";
import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

export const GridLocationSchema = BoardLocationSchema.meta({
	description: "One exact board location.",
	id: "GridLocationSchema",
});
export type GridLocationSchema = typeof GridLocationSchema;
export namespace GridLocationSchema {
	export type Type = z.infer<GridLocationSchema>;
}
