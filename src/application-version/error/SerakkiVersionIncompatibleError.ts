import { Data } from "effect";

import type { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";

export class SerakkiVersionIncompatibleError extends Data.TaggedError(
	"SerakkiVersionIncompatibleError",
)<{
	readonly artifact: "Serapack" | "save" | "Editor project" | "Editor version";
	readonly writerVersion: SerakkiVersionSchema.Type;
	readonly readerVersion: SerakkiVersionSchema.Type;
	readonly writerMajor: string;
	readonly readerMajor: string;
	readonly message: string;
}> {}
