import type { Project } from "~/project-authoring/type/Project";
import type { ProjectCatalogEntrySchema } from "~/project-authoring/schema/ProjectCatalogEntrySchema";
import type { NoteSchema } from "~/project-note/schema/NoteSchema";
import type { ProjectPaths } from "./ProjectPaths";

/** One loaded authored workspace; explicit Refresh replaces its metadata. Image requests read disk separately. */
export interface ProjectState {
	readonly catalog: ProjectCatalogEntrySchema.Type;
	readonly notes: ReadonlyArray<NoteSchema.Type>;
	readonly paths: ProjectPaths;
	readonly project: Project;
}
