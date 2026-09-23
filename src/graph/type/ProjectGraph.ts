import type { Effect } from "effect";
import type { Project } from "~/project-authoring/type/Project";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { GraphQueryError } from "~/graph/error/GraphQueryError";

/** One session-local revision cache; no project data or database escapes this capability. */
export interface ProjectGraph {
	readonly queryFx: (
		project: Project,
		input: unknown,
	) => Effect.Effect<GraphResult, GraphQueryError>;
}
