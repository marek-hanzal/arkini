import { Data } from "effect";

/** User-controlled Arkpack metadata could not be parsed into its canonical contract. */
export class ArkpackInputError extends Data.TaggedError("ArkpackInputError")<{
	readonly operation: "create-signature" | "read-sign-key" | "write-sign-key";
	readonly message: string;
	readonly cause: unknown;
}> {}
