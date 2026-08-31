import { useMemo } from "react";

import type { ProjectStartScope } from "~/project-authoring/type/ProjectStartScope";
import { readProjectStartItemIdsFn } from "~/project-authoring/fn/readProjectStartItemIdsFn";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";

export namespace useProjectStartItemPickerController {
	export interface Props {
		readonly onClose: () => void;
		readonly onSelect: (itemId: string) => void;
		readonly scope: ProjectStartScope;
	}

	export interface Output {
		readonly items: GameConfigSchema.Type["items"];
		readonly options: ReadonlyArray<EditorSearchOption>;
		readonly selectItem: (itemId: string) => void;
	}
}

/** Owns allowed-item admission and selection for one initial grid scope. */
export const useProjectStartItemPickerController = ({
	onClose,
	onSelect,
	scope,
}: useProjectStartItemPickerController.Props): useProjectStartItemPickerController.Output => {
	const { items, options } = useEditorItemSearchOptions();
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
		() => options.filter(({ id }) => allowedItemIds.has(id)),
		[
			allowedItemIds,
			options,
		],
	);
	const selectItem = (itemId: string) => {
		onSelect(itemId);
		onClose();
	};

	return {
		items,
		options: allowedOptions,
		selectItem,
	};
};
