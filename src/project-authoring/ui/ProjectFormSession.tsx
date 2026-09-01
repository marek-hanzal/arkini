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

const ProjectStartGridHelp = () => (
	<>
		<h3 className="font-semibold text-foreground">Starting layout controls</h3>
		<ul className="grid gap-2">
			<li>
				<strong className="text-foreground">Click:</strong> Choose an item in an empty slot
				or add one to an existing stack.
			</li>
			<li>
				<strong className="text-foreground">Right click:</strong> Remove the stack.
			</li>
			<li>
				<strong className="text-foreground">Alt/Cmd + drag or Arrow:</strong> Move a stack
				and replace anything at the destination.
			</li>
			<li>
				<strong className="text-foreground">Minus or Delete:</strong> Decrement or remove
				the selected stack.
			</li>
		</ul>
	</>
);

const ProjectFormHelpBySection: Partial<
	Record<
		ProjectSectionId,
		{
			readonly content: ReactNode;
			readonly title: string;
		}
	>
> = {
	board: {
		content: (
			<>
				<p>
					Width and height apply to every playable Board Space. The Space selector
					switches live between the 32 zero-based Spaces from 0 to 31; edits stay scoped
					to the selected Space.
				</p>
				<ProjectStartGridHelp />
			</>
		),
		title: "Board editing",
	},
	toolbar: {
		content: (
			<>
				<p>
					The Toolbar is a passive one-row starting storage. Set its size to zero to
					disable it.
				</p>
				<ProjectStartGridHelp />
			</>
		),
		title: "Toolbar editing",
	},
	inventory: {
		content: (
			<>
				<p>
					Width and height define the shared passive Inventory grid used by every playable
					Space.
				</p>
				<ProjectStartGridHelp />
			</>
		),
		title: "Inventory editing",
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
