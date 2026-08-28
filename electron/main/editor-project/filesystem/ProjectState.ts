import type { EditorProject } from "~/editor/EditorProject";
import type { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";
import type { EditorProjectCatalogEntrySchema } from "~/editor/filesystem/EditorProjectCatalogEntrySchema";
import type { EditorNoteSchema } from "~/editor/note/EditorNoteSchema";
import type { ProjectPaths } from "./ProjectPaths";
import type { VersionHistory } from "./VersionHistory";

/** One loaded canonical workspace; disk is consulted again only by explicit Refresh. */
export interface ProjectState {
	readonly catalog: EditorProjectCatalogEntrySchema.Type;
	readonly notes: ReadonlyArray<EditorNoteSchema.Type>;
	readonly paths: ProjectPaths;
	readonly project: EditorProject;
	readonly scenarios: ReadonlyArray<EditorBoardScenarioSchema.Type>;
	readonly versionHistory: VersionHistory;
}
