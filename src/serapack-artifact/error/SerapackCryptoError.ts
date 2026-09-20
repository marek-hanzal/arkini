import { Data } from "effect";

/** One Serapack cryptographic operation could not use the supplied key material or Web Crypto. */
export class SerapackCryptoError extends Data.TaggedError("SerapackCryptoError")<{
	readonly operation:
		| "generate-key"
		| "hash"
		| "import-private-key"
		| "import-public-key"
		| "sign"
		| "verify";
	readonly cause: unknown;
}> {}
