import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Presents project identity and available game-layout fields owned by the metadata domain. */
export const EditorMetaOverview = () => {
	const project = useEditorProject();
	const config = project.config;
	return (
		<article
			className="rounded-2xl border border-line bg-surface/85 p-5"
			data-ui="EditorMetaOverview"
		>
			<h2 className="text-lg font-semibold">Package identity</h2>
			<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Title</dt>
					<dd className="mt-1 font-medium">{project.title}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Version</dt>
					<dd className="mt-1 font-medium">
						{config?.version ?? project.gameVersion ?? "Not configured"}
					</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Game ID</dt>
					<dd className="mt-1 break-all font-mono text-xs">
						{config?.meta.id ?? "Not configured"}
					</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Workspace</dt>
					<dd className="mt-1 break-all font-mono text-xs">{project.projectId}</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Board</dt>
					<dd className="mt-1 font-medium">
						{config === undefined
							? "Not configured"
							: `${config.meta.board.width} × ${config.meta.board.height}`}
					</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wider text-subtle">Inventory</dt>
					<dd className="mt-1 font-medium">
						{config === undefined
							? "Not configured"
							: `${config.meta.inventory.width} × ${config.meta.inventory.height}`}
					</dd>
				</div>
			</dl>
		</article>
	);
};
