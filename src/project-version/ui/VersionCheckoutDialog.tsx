import { GitCommitHorizontal, RotateCcw, X } from "lucide-react";

import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";

export const VersionCheckoutDialog = ({
	onCancelFn,
	onCommitFn,
	onRestoreFn,
	pending,
	version,
}: {
	readonly onCancelFn: () => void;
	readonly onCommitFn: () => void;
	readonly onRestoreFn: () => void;
	readonly pending: boolean;
	readonly version: ProjectVersionDescriptor;
}) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-2xl rounded-2xl border border-line-strong bg-surface-raised p-6 shadow-2xl"
			data-ui="EditorVersionCheckoutDialog"
		>
			<h2 className="text-lg font-semibold">Replace the entire project?</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				Restoring <strong className="text-foreground">{version.subject}</strong> discards
				the current working copy and any local draft, then reloads every editor tool from
				that saved snapshot.
			</p>
			<div className="mt-6 flex items-center justify-between gap-4">
				<LinkButton
					className="inline-flex items-center gap-1.5"
					disabled={pending}
					onClick={onCancelFn}
				>
					<X className="size-4" />
					Cancel
				</LinkButton>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						className="gap-1.5"
						disabled={pending}
						cursorIntent={pending ? "progress" : undefined}
						onClick={onRestoreFn}
					>
						<RotateCcw className="size-4" />
						Restore and discard
					</Button>
					<PrimaryButton
						className="gap-1.5"
						disabled={pending}
						onClick={onCommitFn}
					>
						<GitCommitHorizontal className="size-4" />
						Go to Commit
					</PrimaryButton>
				</div>
			</div>
		</div>
	</div>
);
