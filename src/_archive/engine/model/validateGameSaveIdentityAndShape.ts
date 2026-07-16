import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";

export const validateSaveIdentityAndShape = ({ config, ctx, save }: GameSaveValidationContext) => {
	if (save.gameId !== config.game.id) {
		addSaveIssue(
			ctx,
			[
				"gameId",
			],
			`Save gameId must match config game id "${config.game.id}".`,
		);
	}

	if (save.inventory.slots.length !== config.game.inventory.slots) {
		addSaveIssue(
			ctx,
			[
				"inventory",
				"slots",
			],
			`Inventory slot count must equal config inventory slots (${config.game.inventory.slots}).`,
		);
	}
};
