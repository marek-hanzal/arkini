import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveOwnedItemQuantity } from "~/v0/game/exclusivity/readGameSaveOwnedItemQuantity";

export namespace isProductLineVisibleForGameSave {
	export interface Props {
		product: Pick<GameConfig["products"][string], "showIf">;
		save: GameSave;
	}
}

export const isProductLineVisibleForGameSave = ({
	product,
	save,
}: isProductLineVisibleForGameSave.Props) => {
	const showIf = product.showIf ?? [];
	if (showIf.length === 0) return true;

	return showIf.some(
		(itemId) =>
			readGameSaveOwnedItemQuantity({
				itemId,
				save,
			}) > 0,
	);
};
