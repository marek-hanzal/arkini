import { Pencil } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { SectionId } from "~/item-authoring/type/Section";

/** Keeps grouped detail sections linked to their exact authoring destination. */
export const ItemDetailSectionHeader = ({
	itemUid,
	sectionId,
	title,
	description,
}: {
	readonly itemUid: string;
	readonly sectionId: SectionId;
	readonly title: string;
	readonly description: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	return (
		<div
			className="flex items-center gap-3"
			data-ui="EditorItemDetailSectionHeader"
		>
			<div className="min-w-0 flex-1">
				<EditorFormSectionDivider
					title={title}
					description={description}
				/>
			</div>
			<LinkButtonLink
				className="inline-flex shrink-0 items-center gap-1.5"
				to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
				params={{
					projectId: project.projectId,
					itemUid,
					sectionId,
				}}
			>
				<Pencil className="size-4" />
				{translator.textFn("Edit")}
			</LinkButtonLink>
		</div>
	);
};
