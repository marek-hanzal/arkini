import { createFileRoute, Outlet } from "@tanstack/react-router";

import { useEditorProject } from "~/authoring-session/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";
import { EditorSectionNavigation } from "~/authoring-shell/navigation/EditorSectionNavigation";
import {
	editorSectionTabActiveClassName,
	editorSectionTabClassName,
	EditorSectionTabs,
} from "~/authoring-shell/navigation/EditorSectionTabs";

export const Route = createFileRoute("/editor/$projectId/versions")({
	component: () => {
		const project = useEditorProject();
		const params = {
			projectId: project.projectId,
		};
		return (
			<section
				className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
				data-ui="EditorVersions"
			>
				<div className="border-b border-line px-4 py-3">
					<EditorSectionNavigation
						title={
							<div>
								<h1 className="text-xl font-semibold">Versions</h1>
								<p className="text-xs text-muted">
									Explicit snapshots of the entire saved project.
								</p>
							</div>
						}
						tabs={
							<EditorSectionTabs label="Version sections">
								<ButtonLink
									to="/editor/$projectId/versions/commit"
									params={params}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										className: editorSectionTabActiveClassName,
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
										className: editorSectionTabActiveClassName,
									}}
									className={editorSectionTabClassName}
								>
									History
								</ButtonLink>
							</EditorSectionTabs>
						}
					/>
				</div>
				<Outlet />
			</section>
		);
	},
});
