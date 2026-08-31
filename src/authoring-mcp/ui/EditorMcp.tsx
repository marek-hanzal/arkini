import { match } from "ts-pattern";

import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import {
	editorSectionTabClassName,
	EditorSectionTabs,
} from "~/authoring-shell/ui/EditorSectionTabs";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink } from "~/ui/ui/Button";
import { EditorMcpSections, type EditorMcpSectionId } from "./EditorMcpSections";
import { EditorMcpServer } from "./EditorMcpServer";
import { EditorMcpSettings } from "./EditorMcpSettings";
import { EditorMcpStatus } from "./EditorMcpStatus";
import { useEditorMcpClipboardController } from "./useEditorMcpClipboardController";
import { useEditorMcpOverviewController } from "./useEditorMcpOverviewController";
import { useEditorMcpSettingsController } from "./useEditorMcpSettingsController";

export const EditorMcp = ({ section }: { readonly section: EditorMcpSectionId }) => {
	const project = useEditorProject();
	const overviewController = useEditorMcpOverviewController();
	const settingsController = useEditorMcpSettingsController({
		onConfigure: overviewController.configure,
		overview: overviewController.overview,
	});
	const clipboardController = useEditorMcpClipboardController();
	const overview = overviewController.overview;
	const error =
		settingsController.error ?? clipboardController.error ?? overviewController.commandError;
	const execute = (command: () => void) => {
		settingsController.clearError();
		command();
	};
	const title = section === "server" ? "MCP - Server" : "MCP - Settings";
	return (
		<section
			className="h-full overflow-auto p-6"
			data-ui="EditorMcp"
		>
			<div className="mx-auto grid max-w-5xl gap-6">
				<EditorSectionNavigation
					title={<h1 className="text-xl font-semibold">{title}</h1>}
					tabs={
						<EditorSectionTabs>
							{EditorMcpSections.map((candidate) => (
								<ButtonLink
									key={candidate.id}
									to="/editor/$projectId/mcp/$sectionId"
									params={{
										projectId: project.projectId,
										sectionId: candidate.id,
									}}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										"data-ui-selected": true,
									}}
									className={editorSectionTabClassName}
								>
									{candidate.label}
								</ButtonLink>
							))}
						</EditorSectionTabs>
					}
				/>
				{error === undefined ? null : (
					<EditorMcpStatus
						message={error}
						tone="danger"
					/>
				)}
				{overview === undefined ? (
					<EditorMcpStatus message="Loading MCP settings…" />
				) : (
					match(section)
						.with("server", () => (
							<EditorMcpServer
								copied={clipboardController.copied}
								onCopy={clipboardController.copy}
								onResetAuth={() => execute(overviewController.resetAuth)}
								onStartLocal={() => execute(overviewController.startLocal)}
								onStartRemote={() => execute(overviewController.startRemote)}
								onStopLocal={() => execute(overviewController.stopLocal)}
								onStopRemote={() => execute(overviewController.stopRemote)}
								overview={overview}
								pending={overviewController.pending}
							/>
						))
						.with("settings", () => (
							<EditorMcpSettings
								authtoken={settingsController.authtoken}
								copied={clipboardController.copied}
								ngrokDomain={settingsController.ngrokDomain}
								onCopy={clipboardController.copy}
								onSaveNgrok={settingsController.saveNgrok}
								onSavePort={settingsController.savePort}
								onSetAuthtoken={settingsController.setAuthtoken}
								onSetNgrokDomain={settingsController.setNgrokDomain}
								onSetPort={settingsController.setPort}
								overview={overview}
								pending={overviewController.pending}
								port={settingsController.port}
							/>
						))
						.exhaustive()
				)}
			</div>
		</section>
	);
};
