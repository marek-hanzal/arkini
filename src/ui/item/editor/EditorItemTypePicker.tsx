import { createId } from "@paralleldrive/cuid2";
import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorItemTypes, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { ButtonLink } from "~/ui/button/Button";
import { editorBackLinkClassName, EditorBackIcon } from "~/ui/editor/EditorBackIcon";

const itemTypePresentation = {
	blueprint: {
		description: "A build plan with one construction line.",
		icon: "icon-[lucide--scroll-text]",
	},
	craft: {
		description: "A consumable or quest-like item with one product line.",
		icon: "icon-[lucide--hammer]",
	},
	deposit: {
		description: "A board resource source with optional finite production lines.",
		icon: "icon-[lucide--mountain]",
	},
	inventory: {
		description: "The singleton item that opens the shared inventory.",
		icon: "icon-[lucide--backpack]",
	},
	producer: {
		description: "A building or actor with one or more selectable product lines.",
		icon: "icon-[lucide--factory]",
	},
	simple: {
		description: "A regular stackable item without specialized behavior.",
		icon: "icon-[lucide--box]",
	},
	stash: {
		description: "A chest or reward container with one opening line.",
		icon: "icon-[lucide--package-open]",
	},
	temporary: {
		description: "A board-only effect that expires after an authored duration.",
		icon: "icon-[lucide--timer]",
	},
} as const satisfies Record<
	EditorItemType,
	{
		readonly description: string;
		readonly icon: string;
	}
>;

/** Starts item creation from the authoritative item discriminator enum. */
export const EditorItemTypePicker = () => {
	const project = useEditorProject();
	const itemUids = useMemo(
		() =>
			Object.fromEntries(
				EditorItemTypes.map((type) => [
					type,
					createId(),
				]),
			),
		[],
	);
	return (
		<section
			className="h-full min-h-0 overflow-y-auto overscroll-contain"
			aria-labelledby="editor-new-item-title"
			data-ui="EditorItemTypePicker"
		>
			<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-3 p-3">
				<ButtonLink
					to="/editor/$projectId/editor/items/list"
					params={{
						projectId: project.projectId,
					}}
					className={editorBackLinkClassName}
					aria-label="Back to items"
				>
					<EditorBackIcon />
				</ButtonLink>
				<h1
					id="editor-new-item-title"
					className="text-xl font-semibold"
				>
					New item
				</h1>
			</header>
			<div className="ak-list grid content-start gap-2 px-3 pt-3 pb-3 sm:grid-cols-2 xl:grid-cols-3">
				{EditorItemTypes.map((type) => {
					const presentation = itemTypePresentation[type];
					return (
						<ButtonLink
							key={type}
							to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
							params={{
								projectId: project.projectId,
								itemUid: itemUids[type],
								sectionId: "identity",
							}}
							search={{
								itemType: type,
							}}
							className="ak-list-row min-h-32 justify-start gap-4 rounded-xl p-4 text-left"
							data-item-type={type}
						>
							<span
								className={`${presentation.icon} size-8 shrink-0 text-accent`}
								aria-hidden="true"
							/>
							<span className="min-w-0">
								<span className="block text-base font-semibold capitalize">
									{type}
								</span>
								<span className="mt-1 block text-xs leading-5 text-muted">
									{presentation.description}
								</span>
							</span>
						</ButtonLink>
					);
				})}
			</div>
		</section>
	);
};
