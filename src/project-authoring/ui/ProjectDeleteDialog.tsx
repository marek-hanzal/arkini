import { Trash2, X } from "lucide-react";

import type { ProjectDescriptor } from "~/project-authoring/schema/ProjectDescriptorSchema";
import type { ProjectOwnershipSchema } from "~/project-authoring/schema/ProjectOwnershipSchema";
import { DangerButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

interface ProjectDeleteDialogProps {
	readonly error?: unknown;
	readonly ownership: ProjectOwnershipSchema.Type;
	readonly pending: boolean;
	readonly project: ProjectDescriptor;
	readonly onCancelFn: () => void;
	readonly onConfirmFn: () => void;
}

/** Explains managed deletion and external-folder unregistration before repository mutation. */
export const ProjectDeleteDialog = ({
	error,
	ownership,
	pending,
	project,
	onCancelFn,
	onConfirmFn,
}: ProjectDeleteDialogProps) => (
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
			<div className="mt-6 flex items-center justify-between gap-4">
				<LinkButton
					className="inline-flex items-center gap-1.5"
					disabled={pending}
					onClick={onCancelFn}
				>
					<X className="size-4" />
					Cancel
				</LinkButton>
				<DangerButton
					className="gap-1.5"
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorProjectDeleteConfirm"
					onClick={onConfirmFn}
				>
					<Trash2 className="size-4" />
					Remove project
				</DangerButton>
			</div>
		</div>
	</div>
);
