import { useNavigate } from "@tanstack/react-router";
import { useCallback, type PropsWithChildren, type ReactNode } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionTabs } from "~/authoring-shell/ui/EditorSectionTabs";
import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { ProjectFormProvider } from "~/project-authoring/ui/ProjectFormContext";
import { ProjectSectionLink } from "~/project-authoring/ui/ProjectSectionLink";
import { ProjectSections, type ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { useProjectFormController } from "~/project-authoring/ui/useProjectFormController";
import { ProjectCompatibilityNotice } from "~/project-version/ui/ProjectCompatibilityNotice";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

const ProjectFormHelpBySection: Partial<
	Record<
		ProjectSectionId,
		{
			readonly content: ReactNode;
			readonly title: ReactNode;
		}
	>
> = {
	board: {
		content: (
			<>
				<Mx label="Board editing help" />
				<Mx label="Starting layout controls help" />
			</>
		),
		title: <Tx label="Board editing" />,
	},
	toolbar: {
		content: (
			<>
				<Mx label="Toolbar editing help" />
				<Mx label="Starting layout controls help" />
			</>
		),
		title: <Tx label="Toolbar editing" />,
	},
	inventory: {
		content: (
			<>
				<Mx label="Inventory editing help" />
				<Mx label="Starting layout controls help" />
			</>
		),
		title: <Tx label="Inventory editing" />,
	},
};

export const ProjectFormSession = ({
	children,
	sectionId,
}: PropsWithChildren<{
	readonly sectionId: ProjectSectionId;
}>) => {
	const navigateFn = useNavigate();
	const project = useEditorProject();
	const onInvalidSectionFn = useCallback(
		(nextSectionId: ProjectSectionId) =>
			navigateFn({
				to: "/editor/$projectId/project/form/$sectionId",
				params: {
					projectId: project.projectId,
					sectionId: nextSectionId,
				},
			}),
		[
			navigateFn,
			project.projectId,
		],
	);
	const controller = useProjectFormController({
		onInvalidSectionFn,
		onSavedFn: () =>
			navigateFn({
				to: "/editor/$projectId/project/detail/$sectionId",
				params: {
					projectId: project.projectId,
					sectionId,
				},
				replace: true,
			}),
	});
	const discardFn = useCallback(async () => {
		controller.discardFn();
		await navigateFn({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				projectId: project.projectId,
				sectionId,
			},
			replace: true,
		});
	}, [
		controller.discardFn,
		navigateFn,
		project.projectId,
		sectionId,
	]);
	return (
		<ProjectFormProvider value={controller}>
			<section
				className="h-full min-h-0"
				data-ui="EditorProjectForm"
			>
				<EditorFormSectionPage
					discardFn={discardFn}
					dirty={controller.isDirty}
					error={controller.error}
					help={ProjectFormHelpBySection[sectionId]}
					leading={
						<EditorHistoryBackButton
							params={{
								projectId: project.projectId,
								sectionId,
							}}
							to="/editor/$projectId/project/detail/$sectionId"
						/>
					}
					notice={
						<ProjectCompatibilityNotice
							compatibility={controller.compatibility}
							version={project.version}
						/>
					}
					rootCard={false}
					saveFn={controller.saveFn}
					saving={controller.isSaving}
					tabs={
						<EditorSectionTabs>
							{ProjectSections.map((candidate) => (
								<ProjectSectionLink
									destination="form"
									key={candidate.id}
									projectId={project.projectId}
									section={candidate}
								/>
							))}
						</EditorSectionTabs>
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
