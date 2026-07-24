import { Data } from "effect";

/** The launcher catalog did not contain exactly one trusted built-in package identity. */
export class BuiltInArkpackResolutionError extends Data.TaggedError(
	"BuiltInArkpackResolutionError",
)<{
	readonly packageId: string;
	readonly matchingCount: number;
	readonly message: string;
}> {}
