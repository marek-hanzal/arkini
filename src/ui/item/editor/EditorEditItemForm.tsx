import { useNavigate } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

/** Owns one local edit form initialized from the canonical item snapshot. */
export const EditorEditItemForm = ({
	children,
	uid,
}: PropsWithChildren<{
	readonly uid: string;
}>) => {
	const project = useEditorProject();
	const navigate = useNavigate();
	const item = useEditorItemByUid(uid);
	if (item === undefined) return <EditorItemNotFound uid={uid} />;
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
			route={{
				kind: "edit",
			}}
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
		>
			{children}
		</EditorItemForm>
	);
};
