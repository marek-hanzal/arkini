import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveShapeSchema";
import type { GameSaveValidationContext } from "~/engine/model/GameSaveConfigValidationContext";
import { validateSaveBoardMemoryLayouts } from "~/engine/model/validateGameSaveBoardMemoryState";
import { validateGameSaveBoardState } from "~/engine/model/validateGameSaveBoardState";
import { validateSaveCraftState } from "~/engine/model/validateGameSaveCraftState";
import { validateSaveIdentityAndShape } from "~/engine/model/validateGameSaveIdentityAndShape";
import { validateSaveInventorySlots } from "~/engine/model/validateGameSaveInventoryState";
import { validateSaveItemCapacities } from "~/engine/model/validateGameSaveItemCapacityState";
import { validateGameSaveItemSpawnJobState } from "~/engine/model/validateGameSaveItemSpawnJobState";
import { validateSaveLineStates } from "~/engine/model/validateGameSaveLineStates";
import { validateSaveProducerCharges } from "~/engine/model/validateGameSaveProducerChargeState";
import { validateSaveProducerInputs } from "~/engine/model/validateGameSaveProducerInputs";
import { validateSaveProducerState } from "~/engine/model/validateGameSaveProducerState";

export const validateGameSaveAgainstConfig = (
	ctx: z.RefinementCtx,
	save: GameSave,
	config: GameConfig,
) => {
	const validationContext = {
		config,
		ctx,
		save,
	} satisfies GameSaveValidationContext;
	validateSaveIdentityAndShape(validationContext);
	validateGameSaveBoardState(validationContext);
	validateSaveInventorySlots(validationContext);
	validateSaveProducerState(validationContext);
	validateSaveLineStates(validationContext);
	validateSaveProducerInputs(validationContext);
	validateSaveCraftState(validationContext);
	validateSaveProducerCharges(validationContext);
	validateSaveItemCapacities(validationContext);
	validateSaveBoardMemoryLayouts(validationContext);
	validateGameSaveItemSpawnJobState(validationContext);
};
