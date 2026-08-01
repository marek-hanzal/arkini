import { useNavigate } from "@tanstack/react-router";
import {
	useCallback,
	useMemo,
	type PropsWithChildren,
	type ReactNode,
} from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import {
	EditorItemFormProvider,
	type EditorItemFormRoute,
} from "~/ui/item/editor/EditorItemFormContext";
import type { EditorItemSectionId } from "~/ui/item/editor/EditorItemSections";
import { useEditorItemFormController } from "~/ui/item/editor/useEditorItemFormController";

export namespace EditorItemForm {
	export interface Props extends PropsWithChildren {
		readonly back: ReactNode;
		readonly initialItem: EditorItem;
		readonly onSaved?: (item: EditorItem) => void | Promise<void>;
		readonly route: EditorItemFormRoute;
		readonly title: string;
	}
}

/** Owns one local item form above every explicit create/edit section leaf. */
export const EditorItemForm = ({
	back,
	children,
	initialItem,
	onSaved,
	route,
	title,
}: EditorItemForm.Props) => {
	const navigate = useNavigate();
	const project = useEditorProject();
	const onInvalidSection = useCallback(
		(section: EditorItemSectionId) => {
			const params = {
				projectId: project.projectId,
				itemUid: initialItem.uid,
			};
			if (route.kind === "create") {
				const search = {
					itemType: route.itemType,
				};
				switch (section) {
					case "identity":
						return navigate({
							to: "/editor/$projectId/editor/items/$itemUid/create/identity",
							params,
							search,
						});
					case "artwork":
						return navigate({
							to: "/editor/$projectId/editor/items/$itemUid/create/artwork",
							params,
							search,
						});
					case "limits":
						return navigate({
							to: "/editor/$projectId/editor/items/$itemUid/create/limits",
							params,
							search,
						});
					case "charges":
						return navigate({
							to: "/editor/$projectId/editor/items/$itemUid/create/charges",
							params,
							search,
						});
					case "merges":
						return navigate({
							to: "/editor/$projectId/editor/items/$itemUid/create/merges",
							params,
							search,
						});
					case "production":
						return navigate({
							to: "/editor/$projectId/editor/items/$itemUid/create/production",
							params,
							search,
						});
				}
			}
			switch (section) {
				case "identity":
					return navigate({
						to: "/editor/$projectId/editor/items/$itemUid/edit/identity",
						params,
					});
				case "artwork":
					return navigate({
						to: "/editor/$projectId/editor/items/$itemUid/edit/artwork",
						params,
					});
				case "limits":
					return navigate({
						to: "/editor/$projectId/editor/items/$itemUid/edit/limits",
						params,
					});
				case "charges":
					return navigate({
						to: "/editor/$projectId/editor/items/$itemUid/edit/charges",
						params,
					});
				case "merges":
					return navigate({
						to: "/editor/$projectId/editor/items/$itemUid/edit/merges",
						params,
					});
				case "production":
					return navigate({
						to: "/editor/$projectId/editor/items/$itemUid/edit/production",
						params,
					});
			}
		},
		[initialItem.uid, navigate, project.projectId, route],
	);
	const controller = useEditorItemFormController({
		initialItem,
		onInvalidSection,
		onSaved,
	});
	const context = useMemo(
		() => ({
			...controller,
			route,
		}),
		[controller, route],
	);

	return (
		<EditorItemFormProvider value={context}>
			<section
				className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
				aria-labelledby="editor-item-form-title"
				data-ui="EditorItemForm"
			>
				<header className="flex min-w-0 flex-wrap items-center gap-3">
					{back}
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
				</header>
				<form
					className="min-h-0"
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void controller.save().catch(() => undefined);
					}}
				>
					{children}
				</form>
			</section>
		</EditorItemFormProvider>
	);
};
