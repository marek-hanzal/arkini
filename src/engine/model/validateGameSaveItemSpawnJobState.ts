import type { GameSave } from "~/engine/model/GameSaveShapeSchema";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";

const readItemSpawnDependencyCycleJobIds = (save: GameSave) => {
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const cycleJobIds = new Set<string>();

	const visit = (jobId: string): boolean => {
		if (visiting.has(jobId)) {
			cycleJobIds.add(jobId);
			return true;
		}
		if (visited.has(jobId)) return cycleJobIds.has(jobId);

		const job = save.itemSpawnJobs[jobId];
		if (!job) return false;

		visiting.add(jobId);
		let hasCycle = false;
		for (const dependencyId of job.afterJobIds ?? []) {
			if (visit(dependencyId)) {
				hasCycle = true;
				cycleJobIds.add(jobId);
			}
		}
		visiting.delete(jobId);
		visited.add(jobId);
		return hasCycle;
	};

	for (const jobId of Object.keys(save.itemSpawnJobs)) {
		visit(jobId);
	}

	return cycleJobIds;
};

const validateSaveItemSpawnJobs = ({ config, ctx, save }: GameSaveValidationContext) => {
	for (const [jobId, job] of Object.entries(save.itemSpawnJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"itemSpawnJobs",
					jobId,
					"id",
				],
				`Item spawn job id must match record key "${jobId}".`,
			);
		}

		if (!config.items[job.itemId]) {
			addSaveIssue(
				ctx,
				[
					"itemSpawnJobs",
					jobId,
					"itemId",
				],
				`Missing item "${job.itemId}".`,
			);
		}

		for (const [dependencyIndex, afterJobId] of (job.afterJobIds ?? []).entries()) {
			if (!save.itemSpawnJobs[afterJobId]) {
				addSaveIssue(
					ctx,
					[
						"itemSpawnJobs",
						jobId,
						"afterJobIds",
						dependencyIndex,
					],
					`Item spawn job dependency "${afterJobId}" must reference an existing item spawn job.`,
				);
			}
		}
	}
};

const validateSaveItemSpawnDependencyCycles = ({ ctx, save }: GameSaveValidationContext) => {
	const itemSpawnDependencyCycleJobIds = readItemSpawnDependencyCycleJobIds(save);
	for (const jobId of itemSpawnDependencyCycleJobIds) {
		addSaveIssue(
			ctx,
			[
				"itemSpawnJobs",
				jobId,
				"afterJobIds",
			],
			`Item spawn job "${jobId}" must not be part of a dependency cycle.`,
		);
	}
};

export const validateGameSaveItemSpawnJobState = (validationContext: GameSaveValidationContext) => {
	validateSaveItemSpawnJobs(validationContext);
	validateSaveItemSpawnDependencyCycles(validationContext);
};
