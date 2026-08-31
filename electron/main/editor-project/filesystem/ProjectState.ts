import type { Project } from "~/project-authoring/type/Project";
import type { BoardScenarioSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import type { ProjectCatalogEntrySchema } from "~/project-authoring/schema/ProjectCatalogEntrySchema";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import type { ProjectPaths } from "./ProjectPaths";
import type { VersionHistory } from "./VersionHistory";

/** One loaded canonical workspace; disk is consulted again only by explicit Refresh. */
export interface ProjectState {
	readonly catalog: ProjectCatalogEntrySchema.Type;
	readonly notes: ReadonlyArray<NoteSchema.Type>;
	readonly paths: ProjectPaths;
	readonly project: Project;
	readonly scenarios: ReadonlyArray<BoardScenarioSchema.Type>;
	readonly versionHistory: VersionHistory;
}
