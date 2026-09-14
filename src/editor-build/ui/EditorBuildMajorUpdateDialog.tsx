import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { PackageCheck, X } from "lucide-react";

import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { DangerButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

/** Warns before replacing an installed package across its save compatibility boundary. */
export const EditorBuildMajorUpdateDialog = ({
	confirmation,
	error,
	pending,
	onCancelFn,
	onConfirmFn,
}: {
	readonly confirmation: EditorBuildMajorUpdateConfirmation;
	readonly error?: string;
	readonly pending: boolean;
	readonly onCancelFn: () => void;
	readonly onConfirmFn: () => void;
}) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-ui="EditorBuildMajorUpdateDialog"
		>
			<h2 className="text-lg font-semibold">
				<Tx label="Update across major versions?" />
			</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				<Tx label="Installed version" />: <strong>{confirmation.installedVersion}</strong>
				<br />
				<Tx label="New version" />: <strong>{confirmation.targetVersion}</strong>
			</p>
			<div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-warning">
				<Mx label="Build major update warning" />
			</div>
			{error === undefined ? null : (
				<p
					className="mt-3 text-sm text-danger"
					data-ui="EditorBuildMajorUpdateError"
				>
					{error}
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
				<DangerButton
					className="gap-1.5"
					data-ui="EditorBuildMajorUpdateConfirm"
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					onClick={onConfirmFn}
				>
					<PackageCheck className="size-4" />
					<Tx label="Update package" />
				</DangerButton>
			</div>
		</div>
	</div>
);
