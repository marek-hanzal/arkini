import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";

export interface ProjectFormDestination {
	readonly avatar?: number;
	readonly sectionId: ProjectSectionId;
}

/** Routes one named avatar validation failure to its fixed Images box. */
export const readProjectFormDestinationForPathFn = (
	path: ReadonlyArray<PropertyKey>,
): ProjectFormDestination => {
	const sectionId = readProjectSectionForPathFn(path);
	const [head, second] = path;
	const avatar =
		head === "avatars" && typeof second === "string"
			? ProjectAvatarKeys.findIndex((slot) => slot === second)
			: -1;
	return sectionId === "images" && avatar >= 0
		? {
				avatar,
				sectionId,
			}
		: {
				sectionId,
			};
};
