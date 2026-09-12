import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { Project } from "../type/Project";

/** Detaches the valid repository projection before handing it to a caller. */
export const cloneProjectFn = (project: Project): Project => ({
	...project,
	config: GameConfigSchema.parse(project.config),
	version: {
		...project.version,
	},
	resources: project.resources.map((resource) => ({
		...resource,
	})),
});
