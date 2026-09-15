import { useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";

import type { SectionDescriptor } from "~/item-authoring/type/Section";

export namespace useItemDetailSectionShortcuts {
	export interface Props {
		readonly enabled: boolean;
		readonly itemUid: string;
		readonly projectId: string;
		readonly sections: ReadonlyArray<SectionDescriptor>;
	}
}

/** Owns unmodified Item Detail section keys while Edit keeps its existing E shortcut. */
export const useItemDetailSectionShortcuts = ({
	enabled,
	itemUid,
	projectId,
	sections,
}: useItemDetailSectionShortcuts.Props) => {
	const router = useRouter();
	useHotkeys(
		sections.flatMap((section) =>
			section.shortcut === undefined
				? []
				: [
						{
							hotkey: {
								key: section.shortcut,
							},
							callback: (event: KeyboardEvent) => {
								if (event.repeat || event.isComposing) return;
								void router.navigate({
									to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
									params: {
										itemUid,
										projectId,
										sectionId: section.id,
									},
								});
							},
						},
					],
		),
		{
			enabled,
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
		},
	);
};
