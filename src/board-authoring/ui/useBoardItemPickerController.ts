import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";

export namespace useBoardItemPickerController {
	export interface Props {
		readonly onCloseFn: () => void;
		readonly onSelectFn: (itemUid: string) => void;
	}

	export interface Output {
		readonly items: GameConfigSchema.Type["items"];
		readonly options: ReadonlyArray<EditorSearchOption>;
		readonly selectItemFn: (itemUid: string) => void;
	}
}

/** Owns item selection for an authored board. */
export const useBoardItemPickerController = ({
	onCloseFn,
	onSelectFn,
}: useBoardItemPickerController.Props): useBoardItemPickerController.Output => {
	const { items, options } = useEditorItemSearchOptions();
	const selectItemFn = (itemUid: string) => {
		const option = options.find((option) => option.id === itemUid);
		if (option === undefined) return;
		onSelectFn(itemUid);
		onCloseFn();
	};

	return {
		items,
		options,
		selectItemFn,
	};
};
