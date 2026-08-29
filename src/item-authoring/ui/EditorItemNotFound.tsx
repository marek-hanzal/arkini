import { useEditorProject } from "~/authoring-session/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/navigation/EditorHistoryBackButton";

/** Presents one missing canonical item route without duplicating navigation chrome. */
export const EditorItemNotFound = ({ uid }: { readonly uid: string }) => {
	const project = useEditorProject();
	return (
		<section
			className="grid h-full place-items-center"
			data-ui="EditorItemNotFound"
		>
			<div className="max-w-lg rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-6 text-center">
				<h1 className="text-xl font-semibold">Item not found</h1>
				<p className="mt-2 text-sm text-muted">No saved item owns UID {uid}.</p>
				<EditorHistoryBackButton
					to="/editor/$projectId/editor/items/list"
					params={{
						projectId: project.projectId,
					}}
					className="mt-5"
				>
					Back
				</EditorHistoryBackButton>
			</div>
		</section>
	);
};
