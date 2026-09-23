import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

import type { readDeleteBlockersFn } from "~/item-authoring/fn/readDeleteBlockersFn";
import type { Project } from "~/project-authoring/type/Project";
import { ButtonLink, DangerButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";
import { DeleteDialog } from "~/item-authoring/ui/DeleteDialog";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useDeleteController } from "~/item-authoring/ui/useDeleteController";
import { ProjectSections } from "~/project-authoring/type/ProjectSections";
import { readProjectSectionForPathFn } from "~/project-authoring/fn/readProjectSectionForPathFn";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";

const DeleteBlockerLink = ({
	blocker,
	project,
}: {
	readonly blocker: readDeleteBlockersFn.Blocker;
	readonly project: Project;
}) => {
	const translator = useTranslator();
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
				className="ak-list-row ak-list-row-interactive grid min-h-0 grid-cols-[auto_1fr_auto] items-center gap-4 p-4 text-left"
			>
				<EditorItemThumbnail
					resourceIds={owner.artwork.default}
					size="sm"
				/>
				<span className="min-w-0">
					<span className="block truncate text-sm font-semibold">
						{owner.title || owner.uid} · {translator.textFn("Delete")}
					</span>
					<span className="mt-1 block text-xs font-normal leading-5 text-muted">
						{blocker.message}
					</span>
				</span>
				<ArrowRight className="size-4 text-muted" />
			</ButtonLink>
		);
	}

	const template =
		blocker.path[0] === "templates" && typeof blocker.path[1] === "number"
			? project.config.templates?.[blocker.path[1]]
			: undefined;
	if (template !== undefined)
		return (
			<ButtonLink
				to="/editor/$projectId/templates/$templateUid/form/$sectionId"
				params={{
					projectId: project.projectId,
					templateUid: template.uid,
					sectionId: "general",
				}}
				className="ak-list-row ak-list-row-interactive flex justify-between gap-4 p-4 text-left"
			>
				<span>
					<span className="block font-semibold">{template.title}</span>
					<span className="text-sm text-muted">{blocker.message}</span>
				</span>
				<ArrowRight className="size-4" />
			</ButtonLink>
		);
	const sectionId = readProjectSectionForPathFn(blocker.path);
	const section = ProjectSections.find((candidate) => candidate.id === sectionId);
	return (
		<ButtonLink
			to="/editor/$projectId/project/form/$sectionId"
			params={{
				projectId: project.projectId,
				sectionId,
			}}
			className="ak-list-row ak-list-row-interactive grid min-h-0 grid-cols-[1fr_auto] items-center gap-4 p-4 text-left"
		>
			<span className="min-w-0">
				<span className="block truncate text-sm font-semibold">
					{translator.textFn("Project")} ·{" "}
					{translator.textFn(section?.label ?? "Settings")}
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
	const translator = useTranslator();
	const controller = useDeleteController({
		item,
	});
	const blocked = controller.blockers.length > 0;
	return (
		<>
			<section
				className="grid gap-3"
				data-ui="EditorItemDeleteSection"
			>
				<Status
					dataUi="EditorItemDeleteState"
					size="large"
					icon={blocked ? ShieldAlert : ShieldCheck}
					title={translator.textFn(
						blocked ? "This item cannot be deleted yet" : "This item can be deleted",
					)}
					description={
						blocked ? (
							`${controller.blockers.length} ${translator.textFn(
								controller.blockers.length === 1
									? "reference must be removed first."
									: "references must be removed first.",
							)}`
						) : (
							<Mx label="Safe item deletion help" />
						)
					}
					action={
						blocked ? (
							<DangerButton
								data-ui="EditorItemForceDeleteOpen"
								onClick={() => controller.openFn(true)}
							>
								{translator.textFn("Force delete…")}
							</DangerButton>
						) : (
							<DangerButton
								data-ui="EditorItemDeleteOpen"
								onClick={() => controller.openFn(false)}
							>
								{translator.textFn("Delete")}
							</DangerButton>
						)
					}
					variant="flat"
				/>
				{blocked ? (
					<div
						className="ak-list grid gap-2"
						data-ui="EditorItemDeleteBlockers"
					>
						{controller.blockers.map((blocker, index) => (
							<DeleteBlockerLink
								blocker={blocker}
								key={`${blocker.path.join(".")}:${index}`}
								project={controller.project}
							/>
						))}
					</div>
				) : null}
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
