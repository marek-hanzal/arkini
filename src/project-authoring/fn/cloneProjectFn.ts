import type { Project } from "../type/Project";

/** Clones mutable project bytes before a filesystem operation retains state. */
export const cloneProjectFn = (project: Project): Project => ({
	...project,
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});
