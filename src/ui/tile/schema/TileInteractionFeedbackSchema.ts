import { z } from "zod";

/** Presentation-only feedback emitted while one authoritative drop outcome settles. */
export const TileInteractionFeedbackSchema = z.enum([
	"accepted",
	"rejected",
	"ignored",
]);

export type TileInteractionFeedbackSchema = typeof TileInteractionFeedbackSchema;

export namespace TileInteractionFeedbackSchema {
	export type Type = z.infer<TileInteractionFeedbackSchema>;
}
