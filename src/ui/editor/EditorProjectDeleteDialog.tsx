import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { Button, DangerButton } from "~/ui/button/Button";

export interface EditorProjectDeleteDialogProps {
	readonly error?: unknown;
	readonly pending: boolean;
	readonly project: EditorProjectDescriptor;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}

/** Makes permanent project deletion explicit before touching repository state. */
export const EditorProjectDeleteDialog = ({
	error,
	pending,
	project,
	onCancel,
	onConfirm,
}: EditorProjectDeleteDialogProps) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-ui="EditorProjectDeleteDialog"
		>
			<h2 className="text-lg font-semibold">Delete project?</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				Delete <strong className="text-foreground">{project.title}</strong>, including all
				of its resources and Board scenarios? This action is permanent and cannot be undone.
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
					{pending ? "Deleting…" : "Delete project"}
				</DangerButton>
			</div>
		</div>
	</div>
);
