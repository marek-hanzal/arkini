import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Presents game identity and layout fields owned by the metadata domain. */
export const EditorMetaOverview = () => {
	const project = useEditorProject();
	return (
		<article
			className="rounded-2xl border border-line bg-surface/85 p-5"
			data-ui="EditorMetaOverview"
		>
			<h2 className="text-lg font-semibold">Package identity</h2>
			<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Title</dt>
					<dd className="mt-1 font-medium">{project.config.meta.title}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Version</dt>
					<dd className="mt-1 font-medium">{project.config.version}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Game ID</dt>
					<dd className="mt-1 break-all font-mono text-xs">{project.config.meta.id}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Workspace</dt>
					<dd className="mt-1 break-all font-mono text-xs">{project.projectId}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Board</dt>
					<dd className="mt-1 font-medium">
						{project.config.meta.board.width} × {project.config.meta.board.height}
					</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Inventory</dt>
					<dd className="mt-1 font-medium">
						{project.config.meta.inventory.width} × {project.config.meta.inventory.height}
					</dd>
				</div>
			</dl>
		</article>
	);
};
