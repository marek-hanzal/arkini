import type { GameConfigValidationContext } from "~/config/validation/GameConfigValidationCommon";
import { validateStartingBoardState } from "~/config/validation/validateStartingBoardState";
import { validateStartingInventoryState } from "~/config/validation/validateStartingInventoryState";

export const validateStartingState = ({
	config: value,
	ctx,
	hasItem,
}: GameConfigValidationContext) => {
	validateStartingInventoryState({
		ctx,
		hasItem,
		value,
	});
	validateStartingBoardState({
		ctx,
		hasItem,
		value,
	});
};
