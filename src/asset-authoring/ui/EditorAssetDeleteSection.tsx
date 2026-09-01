import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

import type { Project } from "~/project-authoring/type/Project";
import { ProjectAvatarKeys } from "~/project-authoring/schema/ProjectFormSchema";
import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import { Button, ButtonLink, DangerButton } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorAssetDeleteController } from "~/asset-authoring/ui/useEditorAssetDeleteController";

const EditorAssetDeleteError = ({ error }: { readonly error: unknown }) =>
	error === undefined ? null : (
		<p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
			{error instanceof Error ? error.message : String(error)}
		</p>
	);

const EditorAssetDeleteDialog = ({
	error,
	filter,
	pending,
	project,
	query,
	resourceId,
	onCancelFn,
	onConfirmFn,
}: {
	readonly error: unknown;
	readonly filter: "all" | "unused";
	readonly pending: boolean;
	readonly project: Project;
	readonly query: string;
	readonly resourceId: string;
	readonly onCancelFn: () => void;
	readonly onConfirmFn: () => void;
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
					disabled={pending}
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
					onClick={onCancelFn}
				>
					Cancel
				</Button>
				<DangerButton
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					data-ui="EditorAssetDeleteConfirm"
					onClick={onConfirmFn}
				>
					Delete asset
				</DangerButton>
			</div>
		</div>
	</div>
);

const EditorAssetDeleteBlockerLink = ({
	blocker,
	project,
}: {
	readonly blocker: readGameResourceUsagesFn.Usage;
	readonly project: Project;
}) => {
	if (blocker.owner === "item") {
		const owner = project.config.items[blocker.ownerId];
		if (owner !== undefined)
			return (
				<ButtonLink
					to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
					params={{
						itemUid: blocker.ownerUid,
						projectId: project.projectId,
						sectionId: "artwork",
					}}
					className="grid min-h-0 grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-line bg-surface/70 p-4 text-left shadow-none"
				>
					<EditorItemThumbnail
						resourceIds={owner.asset.default}
						size="sm"
					/>
					<span className="min-w-0">
						<span className="block truncate text-sm font-semibold">
							{blocker.ownerLabel || blocker.ownerId} · Artwork
						</span>
						<span className="mt-1 block text-xs font-normal leading-5 text-muted">
							{blocker.roleLabel}
						</span>
					</span>
					<ArrowRight className="size-4 text-muted" />
				</ButtonLink>
			);
	}

	const role = blocker.path[1];
	const roleIndex = ProjectAvatarKeys.findIndex((key) => key === role);
	const avatarIndex =
		roleIndex < 0
			? undefined
			: ProjectAvatarKeys.slice(0, roleIndex + 1).filter(
					(key) => project.config.resources[key] !== undefined,
				).length - 1;
	return (
		<ButtonLink
			to="/editor/$projectId/project/form/$sectionId"
			params={{
				projectId: project.projectId,
				sectionId: "general",
			}}
			search={
				avatarIndex === undefined
					? {}
					: {
							avatar: avatarIndex,
						}
			}
			className="grid min-h-0 grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-line bg-surface/70 p-4 text-left shadow-none"
		>
			<span className="min-w-0">
				<span className="block truncate text-sm font-semibold">Project · General</span>
				<span className="mt-1 block text-xs font-normal leading-5 text-muted">
					{blocker.roleLabel}
				</span>
			</span>
			<ArrowRight className="size-4 text-muted" />
		</ButtonLink>
	);
};

interface EditorAssetDeleteSectionProps extends useEditorAssetDeleteController.Props {}

/** Explains asset-delete eligibility and exposes the guarded destructive action. */
export const EditorAssetDeleteSection = ({
	filter,
	query,
	resourceId,
}: EditorAssetDeleteSectionProps) => {
	const controller = useEditorAssetDeleteController({
		filter,
		query,
		resourceId,
	});
	const blocked = controller.blockers.length > 0;
	const StateIcon = blocked ? ShieldAlert : ShieldCheck;
	return (
		<>
			<section
				className="grid gap-5"
				data-ui="EditorAssetDeleteSection"
			>
				<div className="flex items-start gap-3">
					<StateIcon
						className="mt-0.5 size-6 shrink-0 text-success data-[ui-blocked=true]:text-warning"
						{...readDataUiFn({
							dataUi: "EditorAssetDeleteStateIcon",
							state: {
								blocked,
							},
						})}
					/>
					<div>
						<h2 className="text-lg font-semibold">
							{blocked
								? "This asset cannot be deleted yet"
								: "This asset can be deleted"}
						</h2>
						<p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
							{blocked
								? `${controller.blockers.length} ${controller.blockers.length === 1 ? "reference must" : "references must"} be removed first.`
								: "No saved project or item currently references this asset."}
						</p>
					</div>
				</div>

				{blocked ? (
					<div className="grid gap-2">
						{controller.blockers.map((blocker) => (
							<EditorAssetDeleteBlockerLink
								blocker={blocker}
								key={blocker.path.join(".")}
								project={controller.project}
							/>
						))}
					</div>
				) : (
					<div>
						<DangerButton
							data-ui="EditorAssetDeleteOpen"
							onClick={controller.openFn}
						>
							Delete asset
						</DangerButton>
					</div>
				)}
			</section>
			{controller.confirming ? (
				<EditorAssetDeleteDialog
					error={controller.error}
					filter={filter}
					pending={controller.deleting}
					project={controller.project}
					query={query}
					resourceId={resourceId}
					onCancelFn={controller.cancelFn}
					onConfirmFn={() => void controller.confirmFn()}
				/>
			) : null}
		</>
	);
};
