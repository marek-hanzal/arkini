import type { EditorProjectVersionDescriptor } from "~/editor/version/EditorProjectVersion";
import { Button, DangerButton, PrimaryButton } from "~/ui/button/Button";

export const EditorVersionCheckoutDialog = ({
	onCancel,
	onCommit,
	onRestore,
	pending,
	version,
}: {
	readonly onCancel: () => void;
	readonly onCommit: () => void;
	readonly onRestore: () => void;
	readonly pending: boolean;
	readonly version: EditorProjectVersionDescriptor;
}) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-lg rounded-2xl border border-line-strong bg-surface-raised p-6 shadow-2xl"
			data-ui="EditorVersionCheckoutDialog"
		>
			<h2 className="text-lg font-semibold">Replace the entire project?</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				Restoring <strong className="text-foreground">{version.subject}</strong> discards
				the current working copy and any local draft, then reloads every editor tool from
				that saved snapshot.
			</p>
			<div className="mt-6 flex flex-wrap justify-end gap-2">
				<Button
					disabled={pending}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<PrimaryButton
					disabled={pending}
					onClick={onCommit}
				>
					Go to Commit
				</PrimaryButton>
				<DangerButton
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					onClick={onRestore}
				>
					{pending ? "Restoring…" : "Restore and discard"}
				</DangerButton>
			</div>
		</div>
	</div>
);
