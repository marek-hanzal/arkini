import { useSyncExternalStore } from "react";

import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";
import { useOverlayFocus } from "~/ui/focus/useOverlayFocus";

type UnsavedChangesState = ReturnType<
	ReturnType<typeof useEditorUnsavedChangesOwner>["getSnapshot"]
>;

const EditorUnsavedChangesPrompt = ({ state }: { readonly state: UnsavedChangesState }) => {
	const owner = useEditorUnsavedChangesOwner();
	const focus = useOverlayFocus({
		onClose: () => void owner.decide("cancel"),
	});

	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
			<div
				ref={focus.overlayRef}
				className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
				data-ui="EditorUnsavedChangesDialog"
				onKeyDown={focus.onKeyDown}
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
				<div className="mt-6 flex justify-end gap-2">
					<Button
						disabled={state.saving}
						onClick={() => void owner.decide("cancel")}
					>
						Cancel
					</Button>
					<DangerButton
						disabled={state.saving}
						onClick={() => void owner.decide("discard")}
					>
						Discard
					</DangerButton>
					{state.canSave ? (
						<PrimaryButton
							disabled={state.saving}
							cursorIntent={state.saving ? "progress" : undefined}
							onClick={() => void owner.decide("save")}
						>
							Save
						</PrimaryButton>
					) : null}
				</div>
			</div>
		</div>
	);
};

/** Renders and owns interaction focus for the process-wide unsaved-changes prompt. */
export const EditorUnsavedChangesDialog = () => {
	const owner = useEditorUnsavedChangesOwner();
	const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
	return state.promptOpen ? <EditorUnsavedChangesPrompt state={state} /> : null;
};
