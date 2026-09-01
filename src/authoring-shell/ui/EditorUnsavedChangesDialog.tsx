import { Save, Trash2, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useOverlayFocus } from "~/ui/ui/useOverlayFocus";
import type { EditorUnsavedChangesSnapshot } from "~/authoring-session/service/EditorUnsavedChanges";

const EditorUnsavedChangesPrompt = ({
	state,
}: {
	readonly state: EditorUnsavedChangesSnapshot;
}) => {
	const owner = useEditorUnsavedChangesOwner();
	const focus = useOverlayFocus({
		onCloseFn: () => void owner.decideFn("cancel"),
	});

	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
			<div
				ref={focus.overlayRef}
				className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
				data-ui="EditorUnsavedChangesDialog"
				onKeyDown={focus.onKeyDownFn}
			>
				<h2 className="text-lg font-semibold">Unsaved changes</h2>
				<p className="mt-2 text-sm leading-6 text-muted">
					{state.canSave
						? "Save or discard this draft before leaving the editor surface."
						: "This draft is invalid. Discard it or stay here and fix the highlighted fields."}
				</p>
				{state.error === undefined ? null : (
					<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{state.error instanceof Error ? state.error.message : String(state.error)}
					</p>
				)}
				<div className="mt-6 flex items-center justify-between gap-4">
					<LinkButton
						className="inline-flex items-center gap-1.5"
						disabled={state.saving}
						onClick={() => void owner.decideFn("discard")}
					>
						<Trash2 className="size-4" />
						Discard
					</LinkButton>
					<div className="flex items-center gap-2">
						<Button
							className="gap-1.5"
							disabled={state.saving}
							onClick={() => void owner.decideFn("cancel")}
						>
							<X className="size-4" />
							Cancel
						</Button>
						{state.canSave ? (
							<PrimaryButton
								className="gap-1.5"
								disabled={state.saving}
								cursorIntent={state.saving ? "progress" : undefined}
								onClick={() => void owner.decideFn("save")}
							>
								<Save className="size-4" />
								Save
							</PrimaryButton>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
};

/** Renders and owns interaction focus for the process-wide unsaved-changes prompt. */
export const EditorUnsavedChangesDialog = () => {
	const owner = useEditorUnsavedChangesOwner();
	const state = useSyncExternalStore(owner.subscribeFn, owner.getSnapshotFn, owner.getSnapshotFn);
	return state.promptOpen ? <EditorUnsavedChangesPrompt state={state} /> : null;
};
