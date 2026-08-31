import { useMemo } from "react";

import type { ProjectStartScope } from "~/project-authoring/type/ProjectStartScope";
import { readProjectStartItemIdsFn } from "~/project-authoring/fn/readProjectStartItemIdsFn";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";

export namespace useProjectStartItemPickerController {
	export interface Props {
		readonly onClose: () => void;
		readonly onSelect: (itemId: string) => void;
		readonly scope: ProjectStartScope;
	}

	export interface Output {
		readonly items: ReturnType<typeof useEditorItemSearchOptions>["items"];
		readonly options: ReturnType<typeof useEditorItemSearchOptions>["options"];
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
