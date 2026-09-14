import { ArrowRight, Pencil } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { SectionId } from "~/item-authoring/type/Section";

/** Links overview capabilities to their own detail; identity keeps its direct edit action. */
export const ItemDetailSectionHeader = ({
	itemUid,
	sectionId,
	title,
	description,
}: {
	readonly itemUid: string;
	readonly sectionId?: SectionId;
	readonly title: string;
	readonly description?: string;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	return (
		<div
			className="flex min-h-6 items-center gap-3"
			data-ui="EditorItemDetailSectionHeader"
		>
			<div className="min-w-0 flex-1">
				<EditorFormSectionDivider
					title={title}
					description={description}
				/>
			</div>
			{sectionId === undefined ? null : (
				<LinkButtonLink
					className="inline-flex shrink-0 items-center gap-1.5"
					to={
						sectionId === "identity"
							? "/editor/$projectId/editor/items/$itemUid/form/$sectionId"
							: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
					}
					params={{
						projectId: project.projectId,
						itemUid,
						sectionId,
					}}
				>
					{sectionId === "identity" ? <Pencil className="size-4" /> : null}
					{sectionId === "identity"
						? translator.textFn("Edit")
						: translator.textFn("Show all")}
					{sectionId === "identity" ? null : <ArrowRight className="size-4" />}
				</LinkButtonLink>
			)}
		</div>
	);
};
