import type { EditorProjectOwnership } from "~/project-authoring/EditorProjectCandidate";
import type { EditorProjectDescriptor } from "~/project-authoring/EditorProjectDescriptor";
import { Button, DangerButton } from "~/ui/button/Button";

interface EditorProjectDeleteDialogProps {
	readonly error?: unknown;
	readonly ownership: EditorProjectOwnership;
	readonly pending: boolean;
	readonly project: EditorProjectDescriptor;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}

/** Explains managed deletion and external-folder unregistration before repository mutation. */
export const EditorProjectDeleteDialog = ({
	error,
	ownership,
	pending,
	project,
	onCancel,
	onConfirm,
}: EditorProjectDeleteDialogProps) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-project-ownership={ownership}
			data-ui="EditorProjectDeleteDialog"
		>
			<h2 className="text-lg font-semibold">Remove project?</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				Remove <strong className="text-foreground">{project.title}</strong> from the Editor?{" "}
				{ownership === "managed"
					? "This managed project and all its files will be permanently deleted."
					: "This folder project will be removed from Editor. Files on disk remain untouched."}
			</p>
			<p className="mt-2 text-xs text-subtle">Project ID: {project.projectId}</p>
			{error === undefined ? null : (
				<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
					{error instanceof Error ? error.message : String(error)}
				</p>
			)}
			<div className="mt-6 flex justify-end gap-2">
				<Button
					disabled={pending}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<DangerButton
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorProjectDeleteConfirm"
					onClick={onConfirm}
				>
					Remove project
				</DangerButton>
			</div>
		</div>
	</div>
);
