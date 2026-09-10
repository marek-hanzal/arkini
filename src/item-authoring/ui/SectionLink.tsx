import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ButtonLink } from "~/ui/ui/Button";
import { editorSectionTabClassName } from "~/authoring-shell/ui/EditorSectionTabs";
import type { SectionDescriptor } from "~/item-authoring/type/Section";

const activeProps = {
	"data-ui-selected": true,
} as const;
const inactiveProps = {
	"data-ui-selected": false,
} as const;

export const SectionLink = ({
	defaultDraft,
	defaultItemId,
	defaultTitle,
	destination = "form",
	itemType,
	itemUid,
	projectId,
	resourceId,
	section,
}: {
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly destination?: "detail" | "form";
	readonly itemType?: TypeSchema.Type;
	readonly itemUid: string;
	readonly projectId: string;
	readonly resourceId?: string;
	readonly section: SectionDescriptor;
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
		search={{
			...(defaultDraft === undefined
				? {}
				: {
						defaultDraft,
					}),
			...(defaultItemId === undefined
				? {}
				: {
						defaultItemId,
					}),
			...(defaultTitle === undefined
				? {}
				: {
						defaultTitle,
					}),
			...(itemType === undefined
				? {}
				: {
						itemType,
					}),
			...(resourceId === undefined
				? {}
				: {
						resourceId,
					}),
		}}
		activeProps={activeProps}
		inactiveProps={inactiveProps}
		className={editorSectionTabClassName}
	>
		{section.label}
	</ButtonLink>
);
