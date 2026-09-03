import { Pencil, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { useProjectIdentityRenameController } from "~/project-authoring/ui/useProjectIdentityRenameController";
import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

export const ProjectIdentityRenameDialog = ({
	controller,
	project,
}: {
	readonly controller: useProjectIdentityRenameController.Output;
	readonly project: Project;
}) => {
	const [projectId, setProjectIdFn] = useState(project.projectId);
	const [submitted, setSubmittedFn] = useState(false);
	const parsed = IdSchema.safeParse(projectId);
	const fieldError =
		submitted && !parsed.success
			? "Project ID is required."
			: submitted && projectId === project.projectId
				? "Choose a different Project ID."
				: undefined;
	const submitFn = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmittedFn(true);
		if (!parsed.success || projectId === project.projectId) return;
		void controller.renameFn(parsed.data);
	};
	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
			<form
				className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
				data-ui="EditorProjectIdentityRenameDialog"
				onSubmit={submitFn}
			>
				<h2 className="text-lg font-semibold">Rename project ID</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					The new ID makes this a different game to existing saves.
				</p>
				<div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-warning">
					<strong className="block font-semibold">Version history starts fresh.</strong>
					Existing Version commits become unreachable from this project. Gameplay version
					stays the same; the next Version commit becomes a new history root.
				</div>
				<div className="mt-4">
					<EditorTextControl
						error={fieldError}
						label="Project ID"
						name="projectId"
						onChangeFn={setProjectIdFn}
						value={projectId}
					/>
				</div>
				{controller.error === undefined ? null : (
					<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{controller.error instanceof Error
							? controller.error.message
							: String(controller.error)}
					</p>
				)}
				<div className="mt-6 flex items-center justify-between gap-4">
					<LinkButton
						className="inline-flex items-center gap-1.5"
						disabled={controller.pending}
						onClick={controller.cancelFn}
					>
						<X className="size-4" />
						Cancel
					</LinkButton>
					<PrimaryButton
						className="gap-1.5"
						disabled={controller.pending}
						cursorIntent={controller.pending ? "progress" : undefined}
						type="submit"
					>
						<Pencil className="size-4" />
						Rename project
					</PrimaryButton>
				</div>
			</form>
		</div>
	);
};
