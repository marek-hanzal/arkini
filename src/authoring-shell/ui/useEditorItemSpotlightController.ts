import { useHotkey } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export namespace useEditorItemSpotlightController {
	export interface Props {
		readonly enabled: boolean;
		readonly projectId: string;
	}

	export interface Output {
		readonly closeFn: () => void;
		readonly items: GameConfigSchema.Type["items"];
		readonly open: boolean;
		readonly options: ReadonlyArray<EditorSearchOption>;
		readonly selectItemFn: (itemId: string) => void;
	}
}

/** Owns the Editor-wide item lookup shortcut and canonical detail navigation. */
export const useEditorItemSpotlightController = ({
	enabled,
	projectId,
}: useEditorItemSpotlightController.Props): useEditorItemSpotlightController.Output => {
	const router = useRouter();
	const { items, options } = useEditorItemSearchOptions();
	const [open, setOpenFn] = useState(false);
	const closeFn = () => setOpenFn(false);
	const selectItemFn = (itemId: string) => {
		const item = items[itemId];
		if (item === undefined) return;
		closeFn();
		void router.navigate({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				projectId,
				itemUid: item.uid,
				sectionId: "identity",
			},
		});
	};

	useHotkey(
		"Mod+Shift+K",
		(event) => {
			if (event.repeat) return;
			setOpenFn(true);
		},
		{
			enabled,
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
		},
	);

	return {
		closeFn,
		items,
		open,
		options,
		selectItemFn,
	};
};
