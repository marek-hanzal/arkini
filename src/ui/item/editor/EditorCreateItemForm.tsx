import { useNavigate } from "@tanstack/react-router";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import type { EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { useEditorItemDraft } from "~/bridge/item/editor/useEditorItemDraft";
import { ButtonLink } from "~/ui/button/Button";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";

export namespace EditorCreateItemForm {
	export interface Props {
		readonly itemType: EditorItemType;
		readonly uid: string;
	}
}

/** Owns one local create form for a preallocated immutable item UID. */
export const EditorCreateItemForm = ({
	itemType,
	uid,
}: EditorCreateItemForm.Props) => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const initialItem = useEditorItemDraft(itemType, uid);
	return (
		<EditorItemForm
			key={uid}
			back={
				<ButtonLink
					to="/editor/$projectId/editor/items/list"
					params={{ projectId: project.projectId }}
					className="min-h-0 px-3 py-2"
					aria-label="Back to items"
				>
					<span className="icon-[lucide--arrow-left] size-4" />
				</ButtonLink>
			}
			initialItem={initialItem}
			title={`New ${itemType}`}
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
