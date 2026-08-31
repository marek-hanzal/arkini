import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createId } from "@paralleldrive/cuid2";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorItemTypePresentation } from "~/item-authoring/ui/EditorItemTypePresentation";

export const Route = createFileRoute("/editor/$projectId/editor/items/new/select")({
	component: () => {
		const project = useEditorProject();
		const itemUids = useMemo(
			() =>
				Object.fromEntries(
					TypeSchema.options.map((type) => [
						type,
						createId(),
					]),
				),
			[],
		);
		return (
			<section
				className="h-full min-h-0 overflow-y-auto overscroll-contain"
				data-scroll-restoration-id="editor-item-type-picker"
				data-ui="EditorItemTypePicker"
			>
				<header className="ak-editor-page-header flex min-w-0 flex-wrap items-center gap-3 p-3">
					<EditorHistoryBackButton
						to="/editor/$projectId/editor/items/list"
						params={{
							projectId: project.projectId,
						}}
					/>
					<h1 className="text-xl font-semibold">New item</h1>
				</header>
				<div className="ak-list grid content-start gap-2 px-3 pt-3 pb-3 sm:grid-cols-2 xl:grid-cols-3">
					{TypeSchema.options.map((type) => {
						const presentation = EditorItemTypePresentation[type];
						const Icon = presentation.icon;
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
								<Icon className="size-8 shrink-0 text-accent" />
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
	},
});
