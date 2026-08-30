import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorFormSectionPage } from "~/ui/form/EditorFormSectionPage";
import { EditorItemFormProvider } from "~/item-authoring/ui/EditorItemFormContext";
import { EditorItemSectionLink } from "~/item-authoring/ui/EditorItemSectionLink";
import type {
	EditorItemOptionalCapability,
	EditorItemSectionId,
} from "~/item-authoring/type/EditorItemSection";
import { readEditorItemSectionsFn } from "~/item-authoring/fn/readEditorItemSectionsFn";
import { EditorCompatibilityNotice } from "~/project-version/ui/EditorCompatibilityNotice";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { useEditorItemFormController } from "~/item-authoring/ui/useEditorItemFormController";

/** Owns navigation, controller state, tabs, and save presentation for one item form lifecycle. */
export const EditorItemFormSession = ({
	children,
	enableCapability,
	initialItem,
	isNew,
	itemType,
	productionLineId,
	sectionId,
}: PropsWithChildren<{
	readonly enableCapability?: EditorItemOptionalCapability;
	readonly initialItem: ItemSchema.Type;
	readonly isNew: boolean;
	readonly itemType?: TypeSchema.Type;
	readonly productionLineId?: string;
	readonly sectionId: EditorItemSectionId;
}>) => {
	const navigate = useNavigate();
	const project = useEditorProject();
	const onInvalidSection = useCallback(
		(nextSectionId: EditorItemSectionId) =>
			navigate({
				to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
				params: {
					projectId: project.projectId,
					itemUid: initialItem.uid,
					sectionId: nextSectionId,
				},
				search:
					itemType === undefined
						? {}
						: {
								itemType,
							},
			}),
		[
			initialItem.uid,
			itemType,
			navigate,
			project.projectId,
		],
	);
	const controller = useEditorItemFormController({
		enableCapability,
		initialItem,
		onInvalidSection,
		onSaved: (saved) =>
			navigate({
				to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
				params: {
					projectId: project.projectId,
					itemUid: saved.uid,
					sectionId,
				},
				replace: true,
			}),
	});
	const context = useMemo(
		() => ({
			...controller,
			isNew,
			itemType,
			productionLineId,
		}),
		[
			controller,
			isNew,
			itemType,
			productionLineId,
		],
	);
	const sections = readEditorItemSectionsFn(initialItem, "form");
	const params = {
		projectId: project.projectId,
		itemUid: initialItem.uid,
	};
	const title = isNew ? `New ${initialItem.type}` : initialItem.title || initialItem.id;
	return (
		<EditorItemFormProvider value={context}>
			<section
				className="h-full min-h-0"
				data-ui="EditorItemForm"
			>
				<EditorFormSectionPage
					dirty={controller.isDirty}
					error={controller.error}
					notice={
						<EditorCompatibilityNotice
							compatibility={controller.compatibility}
							version={project.version}
						/>
					}
					rootCard={
						sectionId !== "action" &&
						sectionId !== "artwork" &&
						sectionId !== "charges" &&
						sectionId !== "merges" &&
						sectionId !== "production"
					}
					save={controller.save}
					saving={controller.isSaving}
					leading={
						isNew ? (
							<EditorHistoryBackButton
								to="/editor/$projectId/editor/items/list"
								params={{
									projectId: params.projectId,
								}}
							/>
						) : (
							<EditorHistoryBackButton
								to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
								params={{
									...params,
									sectionId,
								}}
							/>
						)
					}
					title={<h1 className="truncate text-xl font-semibold">{title}</h1>}
					tabs={
						<EditorSectionTabs label="Item sections">
							{sections.map((candidate) => (
								<EditorItemSectionLink
									key={candidate.id}
									itemType={itemType}
									itemUid={params.itemUid}
									projectId={params.projectId}
									section={candidate}
								/>
							))}
						</EditorSectionTabs>
					}
				>
					{children}
				</EditorFormSectionPage>
			</section>
		</EditorItemFormProvider>
	);
};
