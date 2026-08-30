import { useMemo } from "react";

import type { EditorProjectStartScope } from "~/project-authoring/type/EditorProjectStartScope";
import { readEditorProjectStartItemIdsFn } from "~/project-authoring/fn/readEditorProjectStartItemIdsFn";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";

export namespace useEditorProjectStartItemPickerController {
	export interface Props {
		readonly onClose: () => void;
		readonly onSelect: (itemId: string) => void;
		readonly scope: EditorProjectStartScope;
	}

	export interface Output {
		readonly items: ReturnType<typeof useEditorItemSearchOptions>["items"];
		readonly options: ReturnType<typeof useEditorItemSearchOptions>["options"];
		readonly selectItem: (itemId: string) => void;
	}
}

/** Owns allowed-item admission and selection for one initial grid scope. */
export const useEditorProjectStartItemPickerController = ({
	onClose,
	onSelect,
	scope,
}: useEditorProjectStartItemPickerController.Props): useEditorProjectStartItemPickerController.Output => {
	const { items, options } = useEditorItemSearchOptions();
	const allowedItemIds = useMemo(
		() =>
			readEditorProjectStartItemIdsFn({
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
