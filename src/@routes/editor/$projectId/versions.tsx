import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink } from "~/ui/ui/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import {
	editorSectionTabClassName,
	EditorSectionTabs,
} from "~/authoring-shell/ui/EditorSectionTabs";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

export const Route = createFileRoute("/editor/$projectId/versions")({
	component: () => {
		const project = useEditorProject();
		const matchRouteFn = useMatchRoute();
		const params = {
			projectId: project.projectId,
		};
		const commitActive =
			matchRouteFn({
				to: "/editor/$projectId/versions/commit",
				params,
			}) !== false;
		const historyActive =
			matchRouteFn({
				to: "/editor/$projectId/versions/history",
				params,
			}) !== false;
		return (
			<EditorSectionPage
				contentMode="viewport"
				header={
					<EditorSectionNavigation
						leading={
							<EditorHistoryBackButton
								params={params}
								to="/editor/$projectId/editor/items/list"
							/>
						}
						title={
							<h1 className="text-xl font-semibold">
								{historyActive ? "History" : "Commit"}
							</h1>
						}
						tabs={
							<EditorSectionTabs>
								<ButtonLink
									to="/editor/$projectId/versions/commit"
									params={params}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										"data-ui-selected": true,
									}}
									className={editorSectionTabClassName}
								>
									Commit
								</ButtonLink>
								<ButtonLink
									to="/editor/$projectId/versions/history"
									params={params}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										"data-ui-selected": true,
									}}
									className={editorSectionTabClassName}
								>
									History
								</ButtonLink>
							</EditorSectionTabs>
						}
						action={
							commitActive ? (
								<EditorPageHelp
									content={<Mx label="Version commit help" />}
									title={<Tx label="Commit version" />}
								/>
							) : historyActive ? (
								<EditorPageHelp
									content={<Mx label="Version history help" />}
									title={<Tx label="Version history" />}
								/>
							) : undefined
						}
					/>
				}
			>
				<div
					className="h-full min-h-0"
					data-ui="EditorVersions"
				>
					<Outlet />
				</div>
			</EditorSectionPage>
		);
	},
});
