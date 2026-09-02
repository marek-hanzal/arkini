import { useState, type FormEvent } from "react";

import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { useProjectIdentityRenameController } from "~/project-authoring/ui/useProjectIdentityRenameController";
import { Button, PrimaryButton } from "~/ui/ui/Button";

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
					The new ID is a different game to existing saves. Gameplay version stays the
					same and the next Version commit starts a new history root.
				</p>
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
				<div className="mt-6 flex justify-end gap-2">
					<Button
						disabled={controller.pending}
						onClick={controller.cancelFn}
						type="button"
					>
						Cancel
					</Button>
					<PrimaryButton
						disabled={controller.pending}
						cursorIntent={controller.pending ? "progress" : undefined}
						type="submit"
					>
						Rename project
					</PrimaryButton>
				</div>
			</form>
		</div>
	);
};
