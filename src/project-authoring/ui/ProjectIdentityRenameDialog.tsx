import type { Project } from "~/project-authoring/type/Project";
import type { useProjectIdentityRenameController } from "~/project-authoring/ui/useProjectIdentityRenameController";
import { ProjectIdDialogForm } from "~/project-authoring/ui/ProjectIdDialogForm";

export const ProjectIdentityRenameDialog = ({
	controller,
	project,
}: {
	readonly controller: useProjectIdentityRenameController.Output;
	readonly project: Project;
}) => {
	return (
		<ProjectIdDialogForm
			error={controller.error}
			initialProjectId={project.projectId}
			mode="rename"
			onCancelFn={controller.cancelFn}
			onSubmitFn={(projectId) => void controller.renameFn(projectId)}
			pending={controller.pending}
			unchangedProjectId={project.projectId}
		/>
	);
};
