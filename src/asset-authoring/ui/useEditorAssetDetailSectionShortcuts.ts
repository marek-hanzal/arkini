import { useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";

import type { AssetCatalogFilterSchema } from "~/asset-authoring/schema/AssetCatalogFilterSchema";
import { EditorAssetDetailSections } from "~/asset-authoring/type/EditorAssetDetailSections";

export namespace useEditorAssetDetailSectionShortcuts {
	export interface Props {
		readonly enabled: boolean;
		readonly filter: AssetCatalogFilterSchema.Type;
		readonly projectId: string;
		readonly query: string;
		readonly resourceId: string;
	}
}

/** Owns the unmodified section keys on Asset Detail while Edit keeps E. */
export const useEditorAssetDetailSectionShortcuts = ({
	enabled,
	filter,
	projectId,
	query,
	resourceId,
}: useEditorAssetDetailSectionShortcuts.Props) => {
	const router = useRouter();
	useHotkeys(
		EditorAssetDetailSections.map((section) => ({
			hotkey: {
				key: section.shortcut,
			},
			callback: (event: KeyboardEvent) => {
				if (event.repeat || event.isComposing) return;
				void router.navigate({
					to: section.to,
					params: {
						projectId,
						resourceId,
					},
					search: {
						filter,
						query,
					},
				});
			},
		})),
		{
			enabled,
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
		},
	);
};
