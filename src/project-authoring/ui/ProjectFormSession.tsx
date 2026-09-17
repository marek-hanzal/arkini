import { useProjectSectionShortcuts } from "~/project-authoring/ui/useProjectSectionShortcuts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, type PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import type { ProjectFormDestination } from "~/project-authoring/fn/readProjectFormDestinationForPathFn";
import { ProjectFormProvider } from "~/project-authoring/ui/ProjectFormContext";
import { ProjectSectionLink } from "~/project-authoring/ui/ProjectSectionLink";
import { ProjectSections, type ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { useProjectFormController } from "~/project-authoring/ui/useProjectFormController";
import { ProjectSectionHelp } from "~/project-authoring/ui/ProjectSectionHelp";

export const ProjectFormSession = ({
	children,
	sectionId,
}: PropsWithChildren<{
	readonly sectionId: ProjectSectionId;
}>) => {
	const navigateFn = useNavigate();
	const project = useEditorProject();
	useProjectSectionShortcuts({
		projectId: project.projectId,
		destination: "form",
	});
	const unsavedChanges = useEditorUnsavedChangesOwner();
	const onInvalidDestinationFn = useCallback(
		({ avatar, sectionId: nextSectionId }: ProjectFormDestination) =>
			navigateFn({
				to: "/editor/$projectId/project/form/$sectionId",
				params: {
					projectId: project.projectId,
					sectionId: nextSectionId,
				},
				search:
					avatar === undefined
						? {}
						: {
								avatar,
							},
			}),
		[
			navigateFn,
			project.projectId,
		],
	);
	const controller = useProjectFormController({
		onInvalidDestinationFn,
		onSavedFn: () => {
			void navigateFn({
				to: "/editor/$projectId/project/detail/$sectionId",
				params: {
					projectId: project.projectId,
					sectionId,
				},
				replace: true,
			}).catch(() => undefined);
		},
	});
	const discardFn = useCallback(async () => {
		if (
			!(await unsavedChanges.requestLeaveFn(
				`/editor/${project.projectId}/project/detail/${sectionId}`,
			))
		)
			return;
		await navigateFn({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				projectId: project.projectId,
				sectionId,
			},
			replace: true,
		});
	}, [
		navigateFn,
		project.projectId,
		sectionId,
		unsavedChanges,
	]);
	return (
		<ProjectFormProvider value={controller}>
			<section
				className="h-full min-h-0"
				data-ui="EditorProjectForm"
			>
				<EditorFormSectionPage
					discardFn={discardFn}
					error={controller.error}
					leading={
						<EditorHistoryBackButton
							params={{
								projectId: project.projectId,
								sectionId,
							}}
							to="/editor/$projectId/project/detail/$sectionId"
						/>
					}
					rootCard={false}
					saveEnabled={controller.isDirty}
					saveFn={controller.saveFn}
					saving={controller.isSaving}
					secondaryNavigation={
						<EditorSectionBar
							help={<EditorPageHelp {...ProjectSectionHelp[sectionId]} />}
						>
							{ProjectSections.map((candidate) => (
								<ProjectSectionLink
									destination="form"
									key={candidate.id}
									projectId={project.projectId}
									section={candidate}
								/>
							))}
						</EditorSectionBar>
					}
					title={
						<h1 className="truncate text-xl font-semibold">
							{project.config.meta.title}
						</h1>
					}
				>
					{children}
				</EditorFormSectionPage>
			</section>
		</ProjectFormProvider>
	);
};
