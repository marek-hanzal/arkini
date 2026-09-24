import { match } from "ts-pattern";
import { Overlay } from "~/ui/ui/Overlay";
import { useEditorSaveShortcut } from "~/editor-control/ui/useEditorSaveShortcut";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FilePlus2, Pencil, X } from "lucide-react";

import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { readProjectIdCollisionErrorFn } from "~/project-authoring/fn/readProjectIdCollisionErrorFn";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

export const ProjectIdDialogForm = ({
	error,
	initialProjectId,
	mode,
	onCancelFn,
	onSubmitFn,
	pending,
	unchangedProjectId,
}: {
	readonly error?: unknown;
	readonly initialProjectId: string;
	readonly mode: "create" | "rename";
	readonly onCancelFn: () => void;
	readonly onSubmitFn: (projectId: string) => void;
	readonly pending: boolean;
	readonly unchangedProjectId?: string;
}) => {
	const translator = useTranslator();
	const creating = mode === "create";
	const ActionIcon = creating ? FilePlus2 : Pencil;
	const formRef = useRef<HTMLFormElement>(null);
	const [projectId, setProjectIdFn] = useState(initialProjectId);
	const [submitted, setSubmittedFn] = useState(false);
	const parsed = IdSchema.safeParse(projectId);
	const projectIdCollisionError = readProjectIdCollisionErrorFn(error);
	const fieldError = match({
		submitted,
		valid: parsed.success,
		unchanged: projectId === unchangedProjectId,
	})
		.with(
			{
				submitted: false,
			},
			() => undefined,
		)
		.with(
			{
				valid: false,
			},
			() => translator.textFn("Project ID is required."),
		)
		.with(
			{
				unchanged: true,
			},
			() => translator.textFn("Choose a different Project ID."),
		)
		.otherwise(() => projectIdCollisionError);
	useEffect(() => {
		if (fieldError === undefined) return;
		requestAnimationFrame(() =>
			formRef.current?.querySelector<HTMLElement>("[data-ui-invalid='true']")?.focus(),
		);
	}, [
		fieldError,
	]);
	const submitFn = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmittedFn(true);
		if (!parsed.success || projectId === unchangedProjectId || pending) return;
		onSubmitFn(parsed.data);
	};
	useEditorSaveShortcut({
		target: formRef,
		saveEnabled: !pending,
		saveFn: () => formRef.current?.requestSubmit(),
	});
	return (
		<Overlay
			onCloseFn={() => {
				if (!pending) onCancelFn();
			}}
		>
			<form
				ref={formRef}
				className="w-full max-w-md rounded-2xl border border-line-strong bg-modal p-6 text-foreground shadow-2xl"
				data-ui={
					creating ? "EditorProjectCreateDialog" : "EditorProjectIdentityRenameDialog"
				}
				onSubmit={submitFn}
			>
				<h2 className="text-lg font-semibold">
					<Tx label={creating ? "Create project" : "Rename project ID"} />
				</h2>
				<div className="mt-2">
					<Mx label={creating ? "Create project help" : "Rename project ID help"} />
				</div>
				<div className="mt-4">
					<EditorTextControl
						error={fieldError}
						label={translator.textFn("Project ID")}
						name="projectId"
						onChangeFn={(value) => {
							setProjectIdFn(value);
							setSubmittedFn(false);
						}}
						placeholder={creating ? translator.textFn("Project ID example") : undefined}
						value={projectId}
					/>
				</div>
				{error === undefined || projectIdCollisionError !== undefined ? null : (
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
						<ActionIcon className="size-4" />
						<Tx label={creating ? "Create project" : "Rename project"} />
					</PrimaryButton>
				</div>
			</form>
		</Overlay>
	);
};
