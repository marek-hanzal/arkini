import { match } from "ts-pattern";

import { ButtonLink } from "~/ui/button/Button";
import { EditorSectionNavigation } from "~/ui/editor/EditorSectionNavigation";
import {
	editorSectionTabActiveClassName,
	editorSectionTabClassName,
	EditorSectionTabs,
} from "~/ui/editor/EditorSectionTabs";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorMcpMcpSettings } from "./EditorMcpMcpSettings";
import { EditorMcpSections, type EditorMcpSectionId } from "./EditorMcpSections";
import { EditorMcpServerSettings } from "./EditorMcpServerSettings";
import { EditorMcpStatus } from "./EditorMcpStatus";
import { EditorMcpTunnelSettings } from "./EditorMcpTunnelSettings";
import { useEditorMcpController } from "./useEditorMcpController";

export const EditorMcp = ({ section }: { readonly section: EditorMcpSectionId }) => {
	const project = useEditorProject();
	const controller = useEditorMcpController();
	return (
		<section
			className="h-full overflow-auto p-6"
			data-ui="EditorMcp"
		>
			<div className="mx-auto grid max-w-5xl gap-6">
				<EditorSectionNavigation
					title={<h1 className="text-xl font-semibold">MCP</h1>}
					tabs={
						<EditorSectionTabs label="MCP sections">
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
										className: editorSectionTabActiveClassName,
									}}
									className={editorSectionTabClassName}
								>
									{candidate.label}
								</ButtonLink>
							))}
						</EditorSectionTabs>
					}
				/>
				{controller.error === undefined ? null : (
					<EditorMcpStatus
						message={controller.error}
						tone="danger"
					/>
				)}
				{controller.overview === undefined ? (
					<EditorMcpStatus message="Loading MCP settings…" />
				) : (
					match(section)
						.with("mcp", () => <EditorMcpMcpSettings controller={controller} />)
						.with("tunnel", () => <EditorMcpTunnelSettings controller={controller} />)
						.with("server", () => <EditorMcpServerSettings controller={controller} />)
						.exhaustive()
				)}
			</div>
		</section>
	);
};
