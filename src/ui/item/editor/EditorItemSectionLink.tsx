import { ButtonLink } from "~/ui/button/Button";
import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import type { EditorItemSectionDescriptor } from "~/ui/item/editor/EditorItemSections";

const className =
	"min-h-0 rounded-b-none border-transparent bg-transparent px-3 py-2 text-sm shadow-none hover:bg-surface-raised";
const activeProps = {
	"aria-selected": true,
	className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
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
		className={className}
		role="tab"
	>
		{section.label}
	</ButtonLink>
);
