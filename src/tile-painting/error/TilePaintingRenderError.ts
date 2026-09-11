import { Data } from "effect";

export class TilePaintingRenderError extends Data.TaggedError("TilePaintingRenderError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}
