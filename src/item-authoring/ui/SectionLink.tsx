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
	destination = "form",
	itemType,
	itemUid,
	projectId,
	section,
}: {
	readonly destination?: "detail" | "form";
	readonly itemType?: TypeSchema.Type;
	readonly itemUid: string;
	readonly projectId: string;
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
	>
		{section.label}
	</ButtonLink>
);
