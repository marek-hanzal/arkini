import { Data } from "effect";

export class GraphQueryError extends Data.TaggedError("GraphQueryError")<{
	readonly reason: "invalid-query" | "stale-revision" | "stale-snapshot" | "missing-node";
	readonly message: string;
}> {}
