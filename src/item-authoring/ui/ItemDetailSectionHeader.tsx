import type { ItemConnectionFilterSchema } from "~/graph/schema/ItemConnectionFilterSchema";
import { ArrowRight, Pencil } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { SectionId } from "~/item-authoring/type/Section";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import type { ReactNode } from "react";

/** Links overview capabilities to their own detail; identity keeps its direct edit action. */
export const ItemDetailSectionHeader = ({
	itemUid,
	sectionId,
	title,
	description,
	filter,
}: {
	readonly itemUid: string;
	readonly sectionId?: SectionId;
	readonly title: string;
	readonly description?: ReactNode;
	readonly filter?: ItemConnectionFilterSchema.Type;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	return (
		<div data-ui="EditorItemDetailSectionHeader">
			<EditorFormSectionDivider
				title={title}
				description={description}
				action={
					sectionId === undefined ? undefined : (
						<LinkButtonLink
							className="inline-flex shrink-0 items-center gap-1.5 data-[ui-action=show-all]:opacity-75 data-[ui-action=show-all]:hover:opacity-100"
							{...readDataUiFn({
								dataUi: "EditorItemSectionAction",
								state: {
									action: sectionId === "identity" ? "edit" : "show-all",
								},
							})}
							to={
								sectionId === "identity"
									? "/editor/$projectId/editor/items/$itemUid/form/$sectionId"
									: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
							}
							search={
								filter === undefined
									? undefined
									: {
											filter,
										}
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
					)
				}
			/>
		</div>
	);
};
