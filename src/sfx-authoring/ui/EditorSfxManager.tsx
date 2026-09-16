import { Sparkles } from "lucide-react";

import { EditorAudioResourceManager } from "~/audio-authoring/ui/EditorAudioResourceManager";
import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import type { Project } from "~/project-authoring/type/Project";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import { EditorSfxAssignmentMenu } from "~/sfx-authoring/ui/EditorSfxAssignmentMenu";
import { useEditorSfxManagerController } from "~/sfx-authoring/ui/useEditorSfxManagerController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButton } from "~/ui/ui/LinkButton";

/** Renders the project SFX library over the shared audio authoring surface. */
export const EditorSfxManager = () => {
	const translator = useTranslator();
	const controller = useEditorSfxManagerController();
	const optimizationPercent =
		controller.optimizationProgress === undefined ||
		controller.optimizationProgress.totalResourceCount === 0
			? 0
			: Math.round(
					(controller.optimizationProgress.completedResourceCount /
						controller.optimizationProgress.totalResourceCount) *
						100,
				);
	const viewOptions = [
		{
			label: translator.textFn("All"),
			value: "all",
		},
		{
			label: translator.textFn("Assigned"),
			value: "assigned",
		},
		{
			label: translator.textFn("Unused"),
			value: "unused",
		},
	] as const satisfies ReadonlyArray<{
		readonly label: string;
		readonly value: useEditorSfxManagerController.View;
	}>;
	const renderResourceActionFn = (resource: Project.Resource) => {
		const assignedEvents = SfxEventPresentation.filter(
			({ event }) => controller.resourceIdByEvent[event] === resource.id,
		);
		return (
			<>
				{assignedEvents.length === 0 ? null : (
					<div className="flex max-w-96 flex-wrap justify-end gap-1.5">
						{assignedEvents.map(({ event, label }) => (
							<span
								className="shrink-0 whitespace-nowrap rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
								data-ui="EditorSfxAssignmentBadge"
								key={event}
							>
								{translator.textFn(label)}
							</span>
						))}
					</div>
				)}
				<EditorSfxAssignmentMenu
					assigningEvent={controller.assigningEvent}
					disabled={
						controller.assignmentPending ||
						controller.deletePending ||
						controller.optimizePending
					}
					pending={
						controller.assignmentPending &&
						controller.assigningResourceId === resource.id
					}
					resourceIdByEvent={controller.resourceIdByEvent}
					resourceId={resource.id}
					toggleAssignmentFn={controller.toggleAssignmentFn}
				/>
			</>
		);
	};

	return (
		<EditorAudioResourceManager
			controller={controller}
			extraError={controller.assignmentError ?? controller.optimizeError}
			renderResourceActionFn={renderResourceActionFn}
			resourceMutationBlocked={controller.optimizePending}
			resources={controller.sfx}
			secondaryActions={
				<LinkButton
					className="inline-flex min-w-28 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap"
					cursorIntent={controller.optimizePending ? "progress" : undefined}
					data-ui="EditorSfxOptimize"
					disabled={
						controller.optimizePending ||
						controller.importPending ||
						controller.deletePending ||
						controller.assignmentPending ||
						controller.totalResourceCount === 0
					}
					onClick={controller.onOptimizeFn}
				>
					<Sparkles className="size-4" />
					{controller.optimizePending
						? controller.optimizationProgress?.phase === "saving"
							? translator.textFn("Saving…")
							: `${translator.textFn("Optimizing")} ${optimizationPercent}%`
						: translator.textFn("Optimize")}
				</LinkButton>
			}
			secondaryNavigation={
				<EditorSectionShortcutNavigation
					dataUi="EditorSfxView"
					onChangeFn={controller.setViewFn}
					options={viewOptions}
					value={controller.view}
				/>
			}
		/>
	);
};
