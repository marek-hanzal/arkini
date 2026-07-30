import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button } from "~/ui/button/Button";
import { useEditorProjectDirectoryAction } from "~/ui/editor/useEditorProjectDirectoryAction";

/** Opens the active contained workspace through the editor filesystem capability. */
export const EditorProjectDirectoryButton = () => {
	const project = useEditorProject();
	const directory = useEditorProjectDirectoryAction(project.projectId);
	return (
		<div
			className="grid justify-items-end gap-2"
			data-ui="EditorProjectDirectoryButton"
		>
			<Button
				disabled={directory.pending}
				cursorIntent={directory.pending ? "progress" : undefined}
				onClick={directory.open}
				className="min-h-0 px-4 py-2 text-sm"
			>
				{directory.pending ? "Opening…" : "Open project folder"}
			</Button>
			{directory.error === undefined ? null : (
				<p className="max-w-md break-words text-right text-xs text-danger">
					{directory.error instanceof Error
						? directory.error.message
						: String(directory.error)}
				</p>
			)}
		</div>
	);
};
