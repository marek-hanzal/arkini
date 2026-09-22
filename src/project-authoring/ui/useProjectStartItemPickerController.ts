import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";

export namespace useProjectStartItemPickerController {
	export interface Props {
		readonly onCloseFn: () => void;
		readonly onSelectFn: (itemId: string) => void;
	}

	export interface Output {
		readonly items: GameConfigSchema.Type["items"];
		readonly options: ReadonlyArray<EditorSearchOption>;
		readonly selectItemFn: (itemId: string) => void;
	}
}

/** Owns item selection for the initial board. */
export const useProjectStartItemPickerController = ({
	onCloseFn,
	onSelectFn,
}: useProjectStartItemPickerController.Props): useProjectStartItemPickerController.Output => {
	const { items, options } = useEditorItemSearchOptions();
	const selectItemFn = (itemId: string) => {
		const option = options.find((option) => option.id === itemId);
		if (option === undefined) return;
		onSelectFn(itemId);
		onCloseFn();
	};

	return {
		items,
		options,
		selectItemFn,
	};
};
