import { useTranslator } from "~/translation/ui/useTranslator";
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
	create,
	itemUid,
	projectId,
	resourceId,
	section,
}: {
	readonly defaultDraft?: boolean;
	readonly defaultItemId?: string;
	readonly defaultTitle?: string;
	readonly destination?: "detail" | "form";
	readonly create?: boolean;
	readonly itemUid: string;
	readonly projectId: string;
	readonly resourceId?: string;
	readonly section: SectionDescriptor;
}) => {
	const translator = useTranslator();
	return (
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
				...(create === undefined
					? {}
					: {
							create,
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
			{translator.textFn(section.label)}
		</ButtonLink>
	);
};
