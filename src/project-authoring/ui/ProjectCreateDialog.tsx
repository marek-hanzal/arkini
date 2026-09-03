import { createId } from "@paralleldrive/cuid2";
import { FilePlus2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

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
	const translator = useTranslator();
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
				<h2 className="text-lg font-semibold">
					<Tx label="Create project" />
				</h2>
				<div className="mt-2">
					<Mx label="Create project help" />
				</div>
				<div className="mt-4">
					<EditorTextControl
						error={
							submitted && !parsed.success
								? translator.textFn("Project ID is required.")
								: undefined
						}
						label={translator.textFn("Project ID")}
						name="projectId"
						onChangeFn={setProjectIdFn}
						placeholder={translator.textFn("Project ID example")}
						value={projectId}
					/>
				</div>
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
						<Tx label="Cancel" />
					</LinkButton>
					<PrimaryButton
						className="gap-1.5"
						disabled={pending}
						cursorIntent={pending ? "progress" : undefined}
						type="submit"
					>
						<FilePlus2 className="size-4" />
						<Tx label="Create project" />
					</PrimaryButton>
				</div>
			</form>
		</div>
	);
};
