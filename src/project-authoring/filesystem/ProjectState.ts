import type { Project } from "~/project-authoring/type/Project";
import type { ProjectCatalogEntrySchema } from "~/project-authoring/schema/ProjectCatalogEntrySchema";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import type { ProjectPaths } from "./ProjectPaths";

/** One loaded canonical workspace; disk is consulted again only by explicit Refresh. */
export interface ProjectState {
	readonly catalog: ProjectCatalogEntrySchema.Type;
	readonly notes: ReadonlyArray<NoteSchema.Type>;
	readonly paths: ProjectPaths;
	readonly project: Project;
}
