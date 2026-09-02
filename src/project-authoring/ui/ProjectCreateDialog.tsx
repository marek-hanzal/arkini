import { createId } from "@paralleldrive/cuid2";
import { useState, type FormEvent } from "react";

import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { Button, PrimaryButton } from "~/ui/ui/Button";

interface ProjectCreateDialogProps {
	readonly error?: unknown;
	readonly pending: boolean;
	readonly onCancelFn: () => void;
	readonly onCreateFn: (projectId: string) => void;
}

/** Collects the package identity before creating one managed Editor project. */
export const ProjectCreateDialog = ({
	error,
	pending,
	onCancelFn,
	onCreateFn,
}: ProjectCreateDialogProps) => {
	const [projectId, setProjectIdFn] = useState(() => `project-${createId()}`);
	const [submitted, setSubmittedFn] = useState(false);
	const parsed = IdSchema.safeParse(projectId);
	const submitFn = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmittedFn(true);
		if (!parsed.success || pending) return;
		onCreateFn(parsed.data);
	};
	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
			<form
				className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
				data-ui="EditorProjectCreateDialog"
				onSubmit={submitFn}
			>
				<h2 className="text-lg font-semibold">Create project</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					Choose the package identity used by builds and gameplay saves. It can be renamed
					later, which makes the project a different game to existing saves.
				</p>
				<div className="mt-4">
					<EditorTextControl
						error={submitted && !parsed.success ? "Project ID is required." : undefined}
						label="Project ID"
						name="projectId"
						onChangeFn={setProjectIdFn}
						placeholder="project:example"
						value={projectId}
					/>
				</div>
				{error === undefined ? null : (
					<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{error instanceof Error ? error.message : String(error)}
					</p>
				)}
				<div className="mt-6 flex justify-end gap-2">
					<Button
						disabled={pending}
						onClick={onCancelFn}
						type="button"
					>
						Cancel
					</Button>
					<PrimaryButton
						disabled={pending}
						cursorIntent={pending ? "progress" : undefined}
						type="submit"
					>
						Create project
					</PrimaryButton>
				</div>
			</form>
		</div>
	);
};
