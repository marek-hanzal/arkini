import { Data } from "effect";

export class GraphQueryError extends Data.TaggedError("GraphQueryError")<{
	readonly reason: "invalid-query" | "stale-revision" | "missing-node";
	readonly message: string;
}> {}
