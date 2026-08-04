import { ButtonLink } from "~/ui/button/Button";
import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import {
	editorSectionTabActiveClassName,
	editorSectionTabClassName,
} from "~/ui/editor/EditorSectionTabs";
import type { EditorItemSectionDescriptor } from "~/ui/item/editor/EditorItemSections";

const activeProps = {
	"aria-selected": true,
	className: editorSectionTabActiveClassName,
} as const;
const inactiveProps = {
	"aria-selected": false,
} as const;

export const EditorItemSectionLink = ({
	destination = "form",
	itemType,
	itemUid,
	projectId,
	section,
}: {
	readonly destination?: "detail" | "form";
	readonly itemType?: EditorItemType;
	readonly itemUid: string;
	readonly projectId: string;
	readonly section: EditorItemSectionDescriptor;
}) => (
	<ButtonLink
		to={
			destination === "detail"
				? "/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				: "/editor/$projectId/editor/items/$itemUid/form/$sectionId"
		}
		params={{
			projectId,
			itemUid,
			sectionId: section.id,
		}}
		search={
			itemType === undefined
				? {}
				: {
						itemType,
					}
		}
		activeProps={activeProps}
		inactiveProps={inactiveProps}
		className={editorSectionTabClassName}
		role="tab"
	>
		{section.label}
	</ButtonLink>
);
