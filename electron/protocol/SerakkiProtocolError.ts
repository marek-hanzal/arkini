import { Data } from "effect";

export class SerakkiProtocolError extends Data.TaggedError("SerakkiProtocolError")<{
	readonly status: number;
	readonly message: string;
}> {}
