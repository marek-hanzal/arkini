import { Data } from "effect";

/** One Arkpack cryptographic operation could not use the supplied key material or Web Crypto. */
export class ArkpackCryptoError extends Data.TaggedError("ArkpackCryptoError")<{
	readonly operation:
		| "generate-key"
		| "hash"
		| "import-private-key"
		| "import-public-key"
		| "sign"
		| "verify";
	readonly cause: unknown;
}> {}
