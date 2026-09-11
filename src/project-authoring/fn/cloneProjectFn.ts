import type { Project } from "../type/Project";

/** Clones mutable project bytes before a filesystem operation retains state. */
export const cloneProjectFn = (project: Project): Project => ({
	...project,
	version: {
		...project.version,
	},
	resources: project.resources.map((resource) => ({
		...resource,
		bytes: resource.bytes.slice(),
	})),
});
