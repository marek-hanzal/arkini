import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItem, EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { useEditorItemDraft } from "~/bridge/item/editor/useEditorItemDraft";
import { convertEditorItem } from "~/bridge/item/editor/convertEditorItem";
import { ButtonLink } from "~/ui/button/Button";
import { EditorSectionTabs } from "~/ui/editor/EditorSectionTabs";
import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";
import { EditorFormSectionPage } from "~/ui/form/EditorFormSectionPage";
import { EditorItemFormProvider } from "~/ui/item/editor/EditorItemFormContext";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { EditorItemSectionLink } from "~/ui/item/editor/EditorItemSectionLink";
import {
	readEditorItemSections,
	type EditorItemOptionalCapability,
	type EditorItemSectionId,
} from "~/ui/item/editor/EditorItemSections";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";
import { useEditorItemFormController } from "~/ui/item/editor/useEditorItemFormController";

export namespace EditorItemForm {
	export interface Props extends PropsWithChildren {
		readonly enableCapability?: EditorItemOptionalCapability;
		readonly itemType?: EditorItemType;
		readonly sectionId?: EditorItemSectionId;
		readonly uid: string;
	}
}

interface EditorItemFormSessionProps extends PropsWithChildren {
	readonly enableCapability?: EditorItemOptionalCapability;
	readonly initialItem: EditorItem;
	readonly isNew: boolean;
	readonly itemType?: EditorItemType;
	readonly sectionId: EditorItemSectionId;
}

/** Owns the single local form lifecycle used by both new and persisted items. */
const EditorItemFormSession = ({
	children,
	enableCapability,
	initialItem,
	isNew,
	itemType,
	sectionId,
}: EditorItemFormSessionProps) => {
	const navigate = useNavigate();
	const project = useEditorProject();
	const onInvalidSection = useCallback(
		(sectionId: EditorItemSectionId) =>
			navigate({
				to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
				params: {
					projectId: project.projectId,
					itemUid: initialItem.uid,
					sectionId,
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
		}),
		[
			controller,
			isNew,
			itemType,
		],
	);
	const sections = readEditorItemSections(initialItem);
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
					rootCard={
						sectionId !== "artwork" &&
						sectionId !== "charges" &&
						sectionId !== "merges" &&
						sectionId !== "production"
					}
					save={controller.save}
					saving={controller.isSaving}
					leading={
						isNew ? (
							<ButtonLink
								to="/editor/$projectId/editor/items/list"
								params={{
									projectId: params.projectId,
								}}
								className={editorBackLinkClassName}
							>
								<EditorBackIcon />
							</ButtonLink>
						) : (
							<ButtonLink
								to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
								params={{
									...params,
									sectionId,
								}}
								className={editorBackLinkClassName}
							>
								<EditorBackIcon />
							</ButtonLink>
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

/** Resolves a canonical item by UID or seeds its first local form from itemType. */
export const EditorItemForm = ({
	children,
	enableCapability,
	itemType,
	sectionId = "identity",
	uid,
}: EditorItemForm.Props) => {
	const persistedItem = useEditorItemByUid(uid);
	const draft = useEditorItemDraft(itemType ?? persistedItem?.type ?? "simple", uid);
	if (persistedItem === undefined && itemType === undefined)
		return <EditorItemNotFound uid={uid} />;
	const initialItem =
		persistedItem === undefined
			? draft
			: itemType === undefined
				? persistedItem
				: convertEditorItem(persistedItem, itemType);
	const isNew = persistedItem === undefined;
	return (
		<EditorItemFormSession
			key={`${initialItem.uid}:${initialItem.type}`}
			enableCapability={enableCapability}
			initialItem={initialItem}
			isNew={isNew}
			itemType={itemType}
			sectionId={sectionId}
		>
			{children}
		</EditorItemFormSession>
	);
};
