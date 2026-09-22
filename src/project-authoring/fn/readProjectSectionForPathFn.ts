import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";

/** Maps one Project form issue path to the routed section that owns it. */
export const readProjectSectionForPathFn = (path: ReadonlyArray<PropertyKey>): ProjectSectionId => {
	const [head, second] = path;
	if (head === "introduction") return "introduction";
	if (head === "hero" || head === "avatars") return "images";
	if (head === "board" || (head === "start" && second === "board")) return "board";
	return "general";
};
