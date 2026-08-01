import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, type PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItem, EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { useEditorItemDraft } from "~/bridge/item/editor/useEditorItemDraft";
import { ButtonLink } from "~/ui/button/Button";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { EditorFormSaveButton } from "~/ui/form/EditorFormSaveButton";
import { EditorItemFormProvider } from "~/ui/item/editor/EditorItemFormContext";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";
import { useEditorItemFormController } from "~/ui/item/editor/useEditorItemFormController";

export namespace EditorItemForm {
	export interface Props extends PropsWithChildren {
		readonly itemType?: EditorItemType;
		readonly uid: string;
	}
}

interface EditorItemFormSessionProps extends PropsWithChildren {
	readonly initialItem: EditorItem;
	readonly isNew: boolean;
	readonly itemType?: EditorItemType;
}

/** Owns the single local form lifecycle used by both new and persisted items. */
const EditorItemFormSession = ({
	children,
	initialItem,
	isNew,
	itemType,
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
		initialItem,
		onInvalidSection,
		onSaved: (saved) =>
			navigate({
				to: "/editor/$projectId/editor/items/$itemUid/view",
				params: {
					projectId: project.projectId,
					itemUid: saved.uid,
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
	const title = isNew ? `New ${initialItem.type}` : initialItem.title || initialItem.id;

	return (
		<EditorItemFormProvider value={context}>
			<section
				className="flex h-full min-h-0 flex-col gap-[var(--ak-viewport-gap)]"
				aria-labelledby="editor-item-form-title"
				data-ui="EditorItemForm"
			>
				<header className="flex min-w-0 flex-wrap items-center gap-3">
					{isNew ? (
						<ButtonLink
							to="/editor/$projectId/editor/items/list"
							params={{
								projectId: project.projectId,
							}}
							className="min-h-0 px-3 py-2"
							aria-label="Back to items"
						>
							<span className="icon-[lucide--arrow-left] size-4" />
						</ButtonLink>
					) : (
						<ButtonLink
							to="/editor/$projectId/editor/items/$itemUid/view"
							params={{
								projectId: project.projectId,
								itemUid: initialItem.uid,
							}}
							className="min-h-0 px-3 py-2"
							aria-label="Back to item"
						>
							<span className="icon-[lucide--arrow-left] size-4" />
						</ButtonLink>
					)}
					<div className="min-w-0 flex-1">
						<h1
							id="editor-item-form-title"
							className="truncate text-xl font-semibold"
						>
							{title}
						</h1>
						<p className="mt-1 text-xs uppercase tracking-wider text-muted">
							{initialItem.type}
						</p>
					</div>
					<EditorFormSaveButton
						dirty={controller.isDirty}
						saving={controller.isSaving}
						save={controller.save}
					/>
				</header>
				<EditorFormContent
					error={controller.error}
					save={controller.save}
				>
					{children}
				</EditorFormContent>
			</section>
		</EditorItemFormProvider>
	);
};

/** Resolves a canonical item by UID or seeds its first local form from itemType. */
export const EditorItemForm = ({ children, itemType, uid }: EditorItemForm.Props) => {
	const persistedItem = useEditorItemByUid(uid);
	const draft = useEditorItemDraft(itemType ?? persistedItem?.type ?? "simple", uid);
	if (persistedItem === undefined && itemType === undefined)
		return <EditorItemNotFound uid={uid} />;
	const initialItem = persistedItem ?? draft;
	const isNew = persistedItem === undefined;
	return (
		<EditorItemFormSession
			key={initialItem.uid}
			initialItem={initialItem}
			isNew={isNew}
			itemType={isNew ? itemType : undefined}
		>
			{children}
		</EditorItemFormSession>
	);
};
