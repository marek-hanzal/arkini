import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";

export interface ProjectFormDestination {
	readonly avatar?: number;
	readonly sectionId: ProjectSectionId;
}

/** Preserves the collection item that owns one routed Project form validation failure. */
export const readProjectFormDestinationForPathFn = (
	path: ReadonlyArray<PropertyKey>,
): ProjectFormDestination => {
	const sectionId = readProjectSectionForPathFn(path);
	const [head, second] = path;
	return sectionId === "artwork" &&
		head === "avatars" &&
		typeof second === "number" &&
		Number.isInteger(second) &&
		second >= 0
		? {
				avatar: second,
				sectionId,
			}
		: {
				sectionId,
			};
};
