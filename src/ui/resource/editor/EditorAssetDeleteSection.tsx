import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

import type { EditorProject } from "~/editor/EditorProject";
import { EditorProjectAvatarKeys } from "~/ui/project/editor/EditorProjectFormSchema";
import type { EditorAssetDeleteBlocker } from "~/editor/resource/fn/readEditorAssetDeleteBlockersFn";
import { ButtonLink, DangerButton } from "~/ui/button/Button";
import { EditorItemThumbnail } from "~/ui/item/EditorItemThumbnail";
import { EditorAssetDeleteDialog } from "~/ui/resource/editor/EditorAssetDeleteDialog";
import { useEditorAssetDeleteController } from "~/ui/resource/editor/useEditorAssetDeleteController";

const EditorAssetDeleteBlockerLink = ({
	blocker,
	project,
}: {
	readonly blocker: EditorAssetDeleteBlocker;
	readonly project: EditorProject;
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
	const roleIndex = EditorProjectAvatarKeys.findIndex((key) => key === role);
	const avatarIndex =
		roleIndex < 0
			? undefined
			: EditorProjectAvatarKeys.slice(0, roleIndex + 1).filter(
					(key) => project.config.resources[key] !== undefined,
				).length - 1;
	return (
		<ButtonLink
			to="/editor/$projectId/project/$sectionId"
			params={{
				projectId: project.projectId,
				sectionId: "appearance",
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
				<span className="block truncate text-sm font-semibold">Project · Appearance</span>
				<span className="mt-1 block text-xs font-normal leading-5 text-muted">
					{blocker.roleLabel}
				</span>
			</span>
			<ArrowRight className="size-4 text-muted" />
		</ButtonLink>
	);
};

export namespace EditorAssetDeleteSection {
	export interface Props extends useEditorAssetDeleteController.Props {}
}

/** Explains asset-delete eligibility and exposes the guarded destructive action. */
export const EditorAssetDeleteSection = ({
	filter,
	query,
	resourceId,
}: EditorAssetDeleteSection.Props) => {
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
						className={`mt-0.5 size-6 shrink-0 ${blocked ? "text-warning" : "text-success"}`}
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
							onClick={controller.open}
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
					onCancel={controller.cancel}
					onConfirm={() => void controller.confirm()}
				/>
			) : null}
		</>
	);
};
