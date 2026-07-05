import type { GameSaveValidationContext } from "~/engine/model/GameSaveConfigValidationContext";
import { validateProducerJobActiveEffectLinks } from "~/engine/model/validateProducerJobActiveEffectLinks";
import { validateProducerQueueOrdering } from "~/engine/model/validateProducerQueueOrdering";
import { validateProducerQueueSizes } from "~/engine/model/validateProducerQueueSizes";
import { validateSaveActiveEffects } from "~/engine/model/validateSaveActiveEffects";
import { validateSaveProducerJobs } from "~/engine/model/validateSaveProducerJobs";

export const validateSaveProducerState = (validationContext: GameSaveValidationContext) => {
	const producerJobState = validateSaveProducerJobs(validationContext);
	const activeEffectIdsByProducerJobId = validateSaveActiveEffects(validationContext);
	validateProducerJobActiveEffectLinks({
		...validationContext,
		activeEffectIdsByProducerJobId,
	});
	validateProducerQueueSizes({
		config: validationContext.config,
		ctx: validationContext.ctx,
		jobCountByItemInstanceId: producerJobState.jobCountByItemInstanceId,
		save: validationContext.save,
	});
	validateProducerQueueOrdering({
		ctx: validationContext.ctx,
		jobsByItemInstanceId: producerJobState.jobsByItemInstanceId,
	});
};
