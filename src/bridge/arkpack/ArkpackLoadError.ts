import { Data } from "effect";

/** A bundled Arkpack asset could not be loaded from its generated application URL. */
export class ArkpackLoadError extends Data.TaggedError("ArkpackLoadError")<{
	readonly operation: "fetch-bytes" | "fetch-signature";
	readonly packageId: string;
	readonly cause: unknown;
	readonly message: string;
}> {}
