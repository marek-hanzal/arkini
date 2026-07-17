import { Data } from "effect";

export class ArkiniProtocolError extends Data.TaggedError("ArkiniProtocolError")<{
	readonly status: number;
	readonly message: string;
}> {}
