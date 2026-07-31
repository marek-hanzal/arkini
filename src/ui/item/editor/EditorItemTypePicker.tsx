import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorItemTypes, type EditorItemType } from "~/bridge/editor/EditorItemModel";
import { ButtonLink } from "~/ui/button/Button";

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
	const draftIds = useMemo(
		() =>
			Object.fromEntries(
				EditorItemTypes.map((type) => [
					type,
					crypto.randomUUID(),
				]),
			),
		[],
	);
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
			aria-labelledby="editor-new-item-title"
			data-ui="EditorItemTypePicker"
		>
			<header className="flex min-w-0 flex-wrap items-center gap-3">
				<ButtonLink
					to="/editor/$projectId/editor"
					params={{
						projectId: project.projectId,
					}}
					className="min-h-0 px-3 py-2"
					aria-label="Back to items"
				>
					<span className="icon-[lucide--arrow-left] size-4" />
				</ButtonLink>
				<div>
					<h1
						id="editor-new-item-title"
						className="text-xl font-semibold"
					>
						New item
					</h1>
					<p className="mt-1 text-sm text-muted">
						Choose the gameplay contract this item will use.
					</p>
				</div>
			</header>
			<div className="ak-list grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2 xl:grid-cols-3">
				{EditorItemTypes.map((type) => {
					const presentation = itemTypePresentation[type];
					return (
						<ButtonLink
							key={type}
							to="/editor/$projectId/editor/new/$itemType"
							params={{
								projectId: project.projectId,
								itemType: type,
							}}
							search={{
								draft: draftIds[type],
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
