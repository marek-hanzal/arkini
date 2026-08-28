import type { EditorBuildMajorUpdateConfirmation } from "~/bridge/arkpack/editor/readEditorBuildInstallPlanFx";
import { Button, DangerButton } from "~/ui/button/Button";

/** Warns before replacing an installed package across its save compatibility boundary. */
export const EditorBuildMajorUpdateDialog = ({
	confirmation,
	error,
	pending,
	onCancel,
	onConfirm,
}: {
	readonly confirmation: EditorBuildMajorUpdateConfirmation;
	readonly error?: string;
	readonly pending: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-ui="EditorBuildMajorUpdateDialog"
		>
			<h2 className="text-lg font-semibold">Update across major versions?</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				The installed package uses gameplay version {confirmation.installedVersion}; this
				build uses {confirmation.targetVersion}.
			</p>
			<div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-warning">
				Installing the update does not delete saved progress now. The next launch will
				reject the incompatible save; continuing requires permanently deleting this
				package&apos;s existing saved progress.
			</div>
			{error === undefined ? null : (
				<p
					className="mt-3 text-sm text-danger"
					data-ui="EditorBuildMajorUpdateError"
				>
					{error}
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
					data-ui="EditorBuildMajorUpdateConfirm"
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					onClick={onConfirm}
				>
					Update package
				</DangerButton>
			</div>
		</div>
	</div>
);
