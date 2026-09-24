import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";
import { useNavigate } from "@tanstack/react-router";

import type { SectionDescriptor } from "~/item-authoring/type/Section";

export namespace useItemSectionShortcuts {
	export interface Props {
		readonly enabled: boolean;
		readonly destination?: "detail" | "form";
		readonly search?: {
			readonly defaultTitle?: string;
			readonly create?: boolean;
			readonly resourceUid?: string;
		};
		readonly itemUid: string;
		readonly projectId: string;
		readonly sections: ReadonlyArray<SectionDescriptor>;
	}
}

/** Owns Item section routing in detail and the retained form session; Edit keeps E. */
export const useItemSectionShortcuts = ({
	enabled,
	destination = "detail",
	search,
	itemUid,
	projectId,
	sections,
}: useItemSectionShortcuts.Props) => {
	const navigateFn = useNavigate();
	useSectionShortcuts({
		enabled,
		options: sections,
		onSelectFn: (section) => {
			void navigateFn({
				to:
					destination === "detail"
						? "/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
						: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
				params: {
					itemUid,
					projectId,
					sectionId: section.id,
				},
				search,
			});
		},
	});
};
