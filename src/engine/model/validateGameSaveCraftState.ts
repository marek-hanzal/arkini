import { readCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import {
	readBoardItemDefinition,
	readItemInstanceDefinition,
} from "~/engine/model/GameSaveValidationReaders";

const validateSaveCraftJobs = ({ config, ctx, save }: GameSaveValidationContext) => {
	const runningCraftJobsByTargetItemInstanceId = new Map<string, string>();
	for (const [jobId, job] of Object.entries(save.craftJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"id",
				],
				`Craft job id must match record key "${jobId}".`,
			);
		}

		const recipe = readCraftRecipeDefinition({
			config,
			recipeId: job.recipeId,
		});
		if (!recipe) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"recipeId",
				],
				`Missing craft recipe "${job.recipeId}".`,
			);
		}

		const target = readBoardItemDefinition({
			config,
			save,
			itemInstanceId: job.targetItemInstanceId,
		});
		if (!target || target.boardItem.itemId !== job.recipeId) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"targetItemInstanceId",
				],
				`Craft job target "${job.targetItemInstanceId}" must reference item recipe "${job.recipeId}".`,
			);
		}

		if (job.delivery && job.delivery.lastBlockedAtMs < job.readyAtMs) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"delivery",
					"lastBlockedAtMs",
				],
				`Craft job "${jobId}" cannot be blocked before it is ready.`,
			);
		}

		const runningJobId = runningCraftJobsByTargetItemInstanceId.get(job.targetItemInstanceId);
		if (runningJobId) {
			addSaveIssue(
				ctx,
				[
					"craftJobs",
					jobId,
					"targetItemInstanceId",
				],
				`Craft target "${job.targetItemInstanceId}" already has running job "${runningJobId}".`,
			);
		} else {
			runningCraftJobsByTargetItemInstanceId.set(job.targetItemInstanceId, jobId);
		}
	}
	return runningCraftJobsByTargetItemInstanceId;
};

const validateSaveCraftInputs = ({
	config,
	ctx,
	runningCraftJobsByTargetItemInstanceId,
	save,
}: GameSaveValidationContext & {
	runningCraftJobsByTargetItemInstanceId: ReadonlyMap<string, string>;
}) => {
	for (const [targetItemInstanceId, state] of Object.entries(save.craftInputs)) {
		const target = readItemInstanceDefinition({
			config,
			save,
			itemInstanceId: targetItemInstanceId,
		});
		const recipeId = target?.itemId;
		const recipe = recipeId
			? readCraftRecipeDefinition({
					config,
					recipeId,
				})
			: undefined;
		if (!target || !recipeId || !recipe) {
			addSaveIssue(
				ctx,
				[
					"craftInputs",
					targetItemInstanceId,
				],
				`Craft input state target "${targetItemInstanceId}" must reference a craft item.`,
			);
			continue;
		}

		const runningJobId = runningCraftJobsByTargetItemInstanceId.get(targetItemInstanceId);
		if (runningJobId) {
			addSaveIssue(
				ctx,
				[
					"craftInputs",
					targetItemInstanceId,
				],
				`Craft target "${targetItemInstanceId}" has running job "${runningJobId}" and must not have editable input state.`,
			);
		}

		for (const [itemId, quantity] of Object.entries(state.items)) {
			const inputSlot = recipe.inputs.find((input) => input.itemId === itemId);
			if (!inputSlot) {
				addSaveIssue(
					ctx,
					[
						"craftInputs",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Craft recipe "${recipeId}" has no input "${itemId}".`,
				);
				continue;
			}

			if (quantity > inputSlot.quantity) {
				addSaveIssue(
					ctx,
					[
						"craftInputs",
						targetItemInstanceId,
						"items",
						itemId,
					],
					`Craft input quantity must be <= recipe input quantity (${inputSlot.quantity}).`,
				);
			}
		}
	}
};

export const validateSaveCraftState = (validationContext: GameSaveValidationContext) => {
	const runningCraftJobsByTargetItemInstanceId = validateSaveCraftJobs(validationContext);
	validateSaveCraftInputs({
		...validationContext,
		runningCraftJobsByTargetItemInstanceId,
	});
};
