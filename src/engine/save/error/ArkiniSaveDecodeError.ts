import { Data } from "effect";

export class ArkiniSaveDecodeError extends Data.TaggedError("ArkiniSaveDecodeError")<{
	readonly cause: unknown;
}> {}
