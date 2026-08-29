import type { EditorProject } from "~/project-authoring/EditorProject";
import { Button, ButtonLink, DangerButton } from "~/ui/button/Button";

const EditorAssetDeleteError = ({ error }: { readonly error: unknown }) =>
	error === undefined ? null : (
		<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
			{error instanceof Error ? error.message : String(error)}
		</p>
	);

export const EditorAssetDeleteDialog = ({
	error,
	filter,
	pending,
	project,
	query,
	resourceId,
	onCancel,
	onConfirm,
}: {
	readonly error: unknown;
	readonly filter: "all" | "unused";
	readonly pending: boolean;
	readonly project: EditorProject;
	readonly query: string;
	readonly resourceId: string;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}) => (
	<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
		<div
			className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
			data-ui="EditorAssetDeleteDialog"
		>
			<h2 className="text-lg font-semibold">Delete asset?</h2>
			<p className="mt-2 text-sm leading-6 text-muted">
				Delete <strong className="text-foreground">{resourceId}</strong> from the project.
			</p>
			<div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm leading-6 text-danger">
				Its image bytes will be removed from the current project. A full saved version can
				restore them; otherwise this cannot be undone.
			</div>
			<p className="mt-2 text-xs text-subtle">Asset ID: {resourceId}</p>
			<EditorAssetDeleteError error={error} />
			<div className="mt-6 flex flex-wrap justify-end gap-2">
				<ButtonLink
					aria-disabled={pending}
					data-ui="EditorAssetDeleteCreateVersion"
					to="/editor/$projectId/versions/commit"
					params={{
						projectId: project.projectId,
					}}
					search={{
						returnTo: `/editor/${encodeURIComponent(project.projectId)}/assets/${encodeURIComponent(resourceId)}/detail/delete?${new URLSearchParams(
							{
								filter,
								query,
							},
						)}`,
					}}
				>
					Create version first…
				</ButtonLink>
				<Button
					disabled={pending}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<DangerButton
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorAssetDeleteConfirm"
					onClick={onConfirm}
				>
					Delete asset
				</DangerButton>
			</div>
		</div>
	</div>
);
