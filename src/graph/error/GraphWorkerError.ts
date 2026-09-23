import { Data } from "effect";

export class GraphWorkerError extends Data.TaggedError("GraphWorkerError")<{
	readonly message: string;
}> {}
