import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { Project } from "~/project-authoring/type/Project";

export interface ItemEstimateSnapshot {
	readonly config: GameConfigSchema.Type;
	readonly projectId: string;
	readonly revision: number;
}

/** Captures the immutable project revision calculated by one Estimate batch. */
export const createItemEstimateSnapshotFn = (project: Project): ItemEstimateSnapshot => ({
	config: project.config,
	projectId: project.projectId,
	revision: project.revision,
});
