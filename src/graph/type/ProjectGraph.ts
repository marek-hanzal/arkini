import type { Effect } from "effect";
import type { Project } from "~/project-authoring/type/Project";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { GraphQueryError } from "~/graph/error/GraphQueryError";
import type {
	GraphDiscoveryResult,
	GraphBatchResult,
	GraphOperationReadResult,
} from "~/graph/type/GraphDiscoveryResult";

/** One session-local revision cache; no project data or database escapes this capability. */
export interface ProjectGraph {
	readonly queryFx: (
		project: Project,
		input: unknown,
	) => Effect.Effect<GraphResult, GraphQueryError>;
	readonly discoveryFx: (
		project: Project,
		input: unknown,
	) => Effect.Effect<GraphDiscoveryResult, GraphQueryError>;
	readonly batchFx: (
		project: Project,
		input: unknown,
	) => Effect.Effect<GraphBatchResult, GraphQueryError>;
	readonly readOperationsFx: (
		project: Project,
		input: unknown,
	) => Effect.Effect<GraphOperationReadResult, GraphQueryError>;
}
