import { match } from "ts-pattern";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";

/** Maps one Project form issue path to the routed section that owns it. */
export const readProjectSectionForPathFn = (path: ReadonlyArray<PropertyKey>): ProjectSectionId => {
	return match(path[0])
		.returnType<ProjectSectionId>()
		.with("introduction", () => "introduction")
		.with("hero", "avatars", () => "images")
		.with("templates", "start", () => "board")
		.otherwise(() => "general");
};
