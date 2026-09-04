import { useMemo } from "react";

import type { ProjectStartScope } from "~/project-authoring/type/ProjectStartScope";
import { readProjectStartItemIdsFn } from "~/project-authoring/fn/readProjectStartItemIdsFn";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";
import type { StartSchema } from "~/game-start/schema/StartSchema";

interface ProjectStartItemPickerOption extends EditorSearchOption {
	readonly maxCountReached?: {
		readonly currentQuantity: number;
		readonly maxCount: number;
	};
}

const readStartItemQuantitiesFn = (start: StartSchema.Type) => {
	const quantities = new Map<string, number>();
	const addFn = (itemId: string, quantity: number) =>
		quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
	start.board.forEach((entry) => addFn(entry.itemId, entry.quantity ?? 1));
	start.inventory.forEach((entry) => addFn(entry.itemId, entry.quantity));
	start.toolbar.forEach((entry) => addFn(entry.itemId, entry.quantity ?? 1));
	return quantities;
};

export namespace useProjectStartItemPickerController {
	export interface Props {
		readonly onCloseFn: () => void;
		readonly onSelectFn: (itemId: string) => void;
		readonly scope: ProjectStartScope;
		readonly start: StartSchema.Type;
	}

	export interface Output {
		readonly items: GameConfigSchema.Type["items"];
		readonly options: ReadonlyArray<ProjectStartItemPickerOption>;
		readonly selectItemFn: (itemId: string) => void;
	}
}

/** Owns allowed-item admission and selection for one initial grid scope. */
export const useProjectStartItemPickerController = ({
	onCloseFn,
	onSelectFn,
	scope,
	start,
}: useProjectStartItemPickerController.Props): useProjectStartItemPickerController.Output => {
	const { items, options } = useEditorItemSearchOptions();
	const itemQuantities = useMemo(
		() => readStartItemQuantitiesFn(start),
		[
			start,
		],
	);
	const allowedItemIds = useMemo(
		() =>
			readProjectStartItemIdsFn({
				items,
				scope,
			}),
		[
			items,
			scope,
		],
	);
	const allowedOptions = useMemo(
		() =>
			options
				.filter(({ id }) => allowedItemIds.has(id))
				.map((option) => {
					const item = items[option.id];
					const currentQuantity = itemQuantities.get(option.id) ?? 0;
					return {
						...option,
						maxCountReached:
							item?.maxCount !== undefined && currentQuantity + 1 > item.maxCount
								? {
										currentQuantity,
										maxCount: item.maxCount,
									}
								: undefined,
					} satisfies ProjectStartItemPickerOption;
				}),
		[
			allowedItemIds,
			itemQuantities,
			items,
			options,
		],
	);
	const selectItemFn = (itemId: string) => {
		if (allowedOptions.some((option) => option.id === itemId && option.maxCountReached)) return;
		onSelectFn(itemId);
		onCloseFn();
	};

	return {
		items,
		options: allowedOptions,
		selectItemFn,
	};
};
