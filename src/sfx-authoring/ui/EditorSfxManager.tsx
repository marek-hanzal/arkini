import { EditorAudioResourceManager } from "~/audio-authoring/ui/EditorAudioResourceManager";
import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import type { Project } from "~/project-authoring/type/Project";
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
	const renderResourceActionFn = (resource: Project.Resource) => (
		<EditorSfxAssignmentMenu
			assigningEvent={controller.assigningEvent}
			disabled={controller.assignmentPending || controller.deletePending}
			pending={controller.assignmentPending && controller.assigningResourceId === resource.id}
			resourceIdByEvent={controller.resourceIdByEvent}
			resourceId={resource.id}
			toggleAssignmentFn={controller.toggleAssignmentFn}
		/>
	);

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
