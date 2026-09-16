import { EditorAudioResourceManager } from "~/audio-authoring/ui/EditorAudioResourceManager";
import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import type { Project } from "~/project-authoring/type/Project";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import { EditorSfxAssignmentMenu } from "~/sfx-authoring/ui/EditorSfxAssignmentMenu";
import { useEditorSfxManagerController } from "~/sfx-authoring/ui/useEditorSfxManagerController";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Renders the project SFX library over the shared audio authoring surface. */
export const EditorSfxManager = () => {
	const translator = useTranslator();
	const controller = useEditorSfxManagerController();
	const viewOptions = [
		{
			label: translator.textFn("All"),
			value: "all",
		},
	] as const;
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
					disabled={controller.assignmentPending || controller.deletePending}
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
			extraError={controller.assignmentError}
			renderResourceActionFn={renderResourceActionFn}
			resources={controller.resources}
			secondaryNavigation={
				<EditorSectionShortcutNavigation
					dataUi="EditorSfxView"
					onChangeFn={() => undefined}
					options={viewOptions}
					value="all"
				/>
			}
		/>
	);
};
