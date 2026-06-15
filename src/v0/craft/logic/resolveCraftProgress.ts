import type { ItemCraftRecipe } from "~/manifest/craft";
import type { ItemId } from "~/manifest/manifestId";

export namespace resolveCraftProgress {
	export interface Props {
		recipe: ItemCraftRecipe;
		storedInputs?: ReadonlyMap<ItemId, number>;
	}
}

export const resolveCraftProgress = ({
	recipe,
	storedInputs = new Map(),
}: resolveCraftProgress.Props) => {
	const delivered = Object.fromEntries(
		recipe.inputs.map((input) => [
			input.itemId,
			storedInputs.get(input.itemId) ?? 0,
		]),
	);
	const required = recipe.inputs.reduce((sum, input) => sum + input.quantity, 0);
	const current = recipe.inputs.reduce((sum, input) => {
		return sum + Math.min(delivered[input.itemId] ?? 0, input.quantity);
	}, 0);
	const inputProgress = required <= 0 ? 0 : Math.min(1, current / required);

	return {
		delivered,
		required,
		current,
		inputProgress,
		inputsComplete: inputProgress >= 1,
	};
};
