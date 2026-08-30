import { Data } from "effect";

import type { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";

export class ArkiniVersionIncompatibleError extends Data.TaggedError(
	"ArkiniVersionIncompatibleError",
)<{
	readonly artifact: "Arkpack" | "save" | "Editor project" | "Editor version";
	readonly writerVersion: ArkiniVersionSchema.Type;
	readonly readerVersion: ArkiniVersionSchema.Type;
	readonly writerMajor: string;
	readonly readerMajor: string;
	readonly message: string;
}> {}
