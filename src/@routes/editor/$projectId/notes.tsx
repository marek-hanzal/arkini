import { createFileRoute } from "@tanstack/react-router";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { ProjectNotes } from "~/project-note/ui/ProjectNotes";
import { useProjectNotes } from "~/project-note/ui/useProjectNotes";

export const Route = createFileRoute("/editor/$projectId/notes")({
	component: () => {
		const project = useEditorProject();
		const collection = useProjectNotes(project.projectId);
		return (
			<EditorSectionPage
				header={
					<EditorSectionNavigation
						action={
							<EditorPageHelp
								content={<Mx label="Notes help" />}
								title={<Tx label="Notes" />}
							/>
						}
						leading={
							<EditorHistoryBackButton
								params={{
									projectId: project.projectId,
								}}
								to="/editor/$projectId/editor/items/list"
							/>
						}
						title={
							<h1 className="text-xl font-semibold">
								<Tx label="Notes" />
							</h1>
						}
					/>
				}
			>
				<ProjectNotes
					collection={collection}
					notes={collection.notes}
					defaultItemUids={[]}
				/>
			</EditorSectionPage>
		);
	},
});
