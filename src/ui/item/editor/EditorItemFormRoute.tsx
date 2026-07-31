import type { EditorItemType } from "~/bridge/editor/EditorItemModel";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { useEditorProjectDraft } from "~/bridge/editor/useEditorProjectDraft";
import { ButtonLink } from "~/ui/button/Button";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";

export type { EditorItemType };

export namespace EditorItemFormRoute {
	export type Props =
		| {
				readonly mode: "create";
				readonly itemType: EditorItemType;
				readonly draftId: string;
		  }
		| {
				readonly mode: "edit";
				readonly itemId: string;
		  };
}

/** Resolves one form session against canonical sources plus an explicit staged item. */
export const EditorItemFormRoute = (props: EditorItemFormRoute.Props) => {
	const project = useEditorProject();
	const staged = useEditorProjectDraft(project.projectId);
	if (props.mode === "create") {
		return (
			<EditorItemForm
				key={`create:${props.itemType}:${props.draftId}`}
				itemType={props.itemType}
				sessionId={`${project.projectId}:new:${props.itemType}:${props.draftId}`}
			/>
		);
	}
	const stagedChange = Object.values(staged).find(
		(change) => change.item.id === props.itemId,
	);
	const canonicalItem = project.config?.items[props.itemId];
	const item = stagedChange?.item ?? canonicalItem;
	const sourcePath = stagedChange?.sourcePath ?? project.itemSourcePaths[props.itemId];
	const sourceItemId =
		stagedChange?.sourceItemId ?? (canonicalItem === undefined ? undefined : props.itemId);
	if (item !== undefined) {
		return (
			<EditorItemForm
				key={`edit:${props.itemId}`}
				item={item}
				itemType={item.type}
				sessionId={`${project.projectId}:${sourcePath ?? `item:${props.itemId}`}`}
				sourceItemId={sourceItemId}
				sourcePath={sourcePath}
			/>
		);
	}
	return (
		<section className="grid h-full place-items-center">
			<div className="max-w-lg rounded-2xl border border-danger/40 bg-surface p-6 text-center">
				<h1 className="text-xl font-semibold">Item not found</h1>
				<p className="mt-2 text-sm text-muted">
					The compiled project does not define {props.itemId}.
				</p>
				<ButtonLink
					to="/editor/$projectId/editor"
					params={{
						projectId: project.projectId,
					}}
					className="mt-5"
				>
					Back to items
				</ButtonLink>
			</div>
		</section>
	);
};
