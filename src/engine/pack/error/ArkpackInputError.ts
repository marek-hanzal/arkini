import { Data } from "effect";

/** User-controlled Arkpack metadata could not be parsed into its canonical contract. */
export class ArkpackInputError extends Data.TaggedError("ArkpackInputError")<{
	readonly operation:
		| "create-signature"
		| "read-private-key"
		| "read-trusted-keys"
		| "write-key-pair";
	readonly message: string;
	readonly cause: unknown;
}> {}
