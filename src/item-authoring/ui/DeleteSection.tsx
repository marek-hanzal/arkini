import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

import type { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import type { Project } from "~/project-authoring/type/Project";
import { ButtonLink, DangerButton } from "~/ui/ui/Button";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { DeleteDialog } from "~/item-authoring/ui/DeleteDialog";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useDeleteController } from "~/item-authoring/ui/useDeleteController";
import { ProjectSections } from "~/project-authoring/type/ProjectSections";
import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";

const DeleteBlockerLink = ({
	blocker,
	project,
}: {
	readonly blocker: readDeleteBlockersFn.Blocker;
	readonly project: Project;
}) => {
	if (
		blocker.path[0] === "items" &&
		typeof blocker.path[1] === "string" &&
		project.config.items[blocker.path[1]] !== undefined
	) {
		const owner = project.config.items[blocker.path[1]];
		return (
			<ButtonLink
				to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				params={{
					itemUid: owner.uid,
					projectId: project.projectId,
					sectionId: "delete",
				}}
				className="grid min-h-0 grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-line bg-surface/70 p-4 text-left shadow-none"
			>
				<EditorItemThumbnail
					resourceIds={owner.asset.default}
					size="sm"
				/>
				<span className="min-w-0">
					<span className="block truncate text-sm font-semibold">
						{owner.title || owner.id} · Delete
					</span>
					<span className="mt-1 block text-xs font-normal leading-5 text-muted">
						{blocker.message}
					</span>
				</span>
				<ArrowRight className="size-4 text-muted" />
			</ButtonLink>
		);
	}

	const sectionId = readProjectSectionForPathFn(blocker.path);
	const section = ProjectSections.find((candidate) => candidate.id === sectionId);
	return (
		<ButtonLink
			to="/editor/$projectId/project/$sectionId"
			params={{
				projectId: project.projectId,
				sectionId,
			}}
			className="grid min-h-0 grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-line bg-surface/70 p-4 text-left shadow-none"
		>
			<span className="min-w-0">
				<span className="block truncate text-sm font-semibold">
					Project · {section?.label ?? "Settings"}
				</span>
				<span className="mt-1 block text-xs font-normal leading-5 text-muted">
					{blocker.message}
				</span>
			</span>
			<ArrowRight className="size-4 text-muted" />
		</ButtonLink>
	);
};

interface DeleteSectionProps extends useDeleteController.Props {}

/** Explains item-delete eligibility and exposes the guarded destructive action. */
export const DeleteSection = ({ item }: DeleteSectionProps) => {
	const controller = useDeleteController({
		item,
	});
	const blocked = controller.blockers.length > 0;
	const StateIcon = blocked ? ShieldAlert : ShieldCheck;
	return (
		<>
			<section
				className="grid gap-5"
				data-ui="EditorItemDeleteSection"
			>
				<div className="flex items-start gap-3">
					<StateIcon
						className="mt-0.5 size-6 shrink-0 text-success data-[ui-blocked=true]:text-warning"
						{...readDataUiFn({
							dataUi: "EditorItemDeleteStateIcon",
							state: {
								blocked,
							},
						})}
					/>
					<div>
						<h2 className="text-lg font-semibold">
							{blocked
								? "This item cannot be deleted yet"
								: "This item can be deleted"}
						</h2>
						<p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
							{blocked
								? `${controller.blockers.length} ${controller.blockers.length === 1 ? "reference must" : "references must"} be removed first.`
								: "No other game configuration references this item. Its asset files will remain available in the project."}
						</p>
					</div>
				</div>

				{blocked ? (
					<div className="grid gap-4">
						<div className="grid gap-2">
							{controller.blockers.map((blocker, index) => (
								<DeleteBlockerLink
									blocker={blocker}
									key={`${blocker.path.join(".")}:${index}`}
									project={controller.project}
								/>
							))}
						</div>
						<div className="rounded-xl border border-danger/35 bg-danger/10 p-4">
							<p className="text-sm leading-6 text-muted">
								Need this item gone anyway? Force Delete removes every starting
								entry, merge rule, production line, and owned output that directly
								references it. The game can remain logically broken afterward.
							</p>
							<DangerButton
								className="mt-3"
								data-ui="EditorItemForceDeleteOpen"
								onClick={() => controller.openFn(true)}
							>
								Force delete item…
							</DangerButton>
						</div>
					</div>
				) : (
					<div>
						<DangerButton
							data-ui="EditorItemDeleteOpen"
							onClick={() => controller.openFn(false)}
						>
							Delete item
						</DangerButton>
					</div>
				)}
			</section>
			{controller.confirming === null ? null : (
				<DeleteDialog
					error={controller.error}
					force={controller.confirming === "force"}
					impact={controller.forceImpact}
					item={item}
					pending={controller.deleting}
					project={controller.project}
					onCancelFn={controller.cancelFn}
					onConfirmFn={() => void controller.confirmFn()}
				/>
			)}
		</>
	);
};
