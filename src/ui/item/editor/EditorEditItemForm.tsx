import { useNavigate } from "@tanstack/react-router";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

/** Owns one local edit form initialized from the canonical item snapshot. */
export const EditorEditItemForm = ({ uid }: { readonly uid: string }) => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const item = useEditorItemByUid(uid);
	if (item === undefined) {
		return (
			<section className="grid h-full place-items-center" data-ui="EditorItemNotFound">
				<div className="max-w-lg rounded-2xl border border-line bg-surface/85 p-6 text-center">
					<h1 className="text-xl font-semibold">Item not found</h1>
					<p className="mt-2 text-sm text-muted">No saved item owns UID {uid}.</p>
					<ButtonLink
						to="/editor/$projectId/editor/items/list"
						params={{ projectId: project.projectId }}
						className="mt-5"
					>
						Back to items
					</ButtonLink>
				</div>
			</section>
		);
	}
	return (
		<EditorItemForm
			key={item.uid}
			back={
				<ButtonLink
					to="/editor/$projectId/editor/items/$itemUid/view"
					params={{
						projectId: project.projectId,
						itemUid: item.uid,
					}}
					className="min-h-0 px-3 py-2"
					aria-label="Back to item"
				>
					<span className="icon-[lucide--arrow-left] size-4" />
				</ButtonLink>
			}
			initialItem={item}
			title={item.title || item.id}
			onSaved={(saved) =>
				navigate({
					to: "/editor/$projectId/editor/items/$itemUid/view",
					params: {
						projectId: project.projectId,
						itemUid: saved.uid,
					},
					replace: true,
				})
			}
		/>
	);
};
