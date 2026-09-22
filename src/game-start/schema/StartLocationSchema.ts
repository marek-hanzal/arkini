import { z } from "zod";
import { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

export const StartLocationSchema = BoardLocationSchema.meta({
	description: "One exact board location.",
	id: "start.LocationSchema",
});
export type StartLocationSchema = typeof StartLocationSchema;
export namespace StartLocationSchema {
	export type Type = z.infer<StartLocationSchema>;
}
