import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Describes the reserved engine-backed, non-persistent gameplay sandbox boundary. */
export const EditorBoard = () => {
	const project = useEditorProject();
	return (
		<section
			className="grid h-full min-h-0 place-items-center overflow-y-auto"
			aria-labelledby="editor-board-title"
			data-ui="EditorBoard"
		>
			<article className="w-full max-w-3xl rounded-2xl border border-line bg-surface/90 p-6 text-center shadow-xl">
				<h1
					id="editor-board-title"
					className="text-2xl font-semibold"
				>
					Board for {project.config.meta.title}
				</h1>
				<p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
					The gameplay sandbox is not enabled in this editor foundation. Its boundary is
					reserved for the same Board, Toolbar, Inventory and game engine with durable saves
					replaced by a temporary editor session.
				</p>
				<dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left text-sm">
					<div className="rounded-xl bg-surface-raised p-3">
						<dt className="text-xs uppercase tracking-wider text-subtle">Board</dt>
						<dd className="mt-1 font-semibold">
							{project.config.meta.board.width} × {project.config.meta.board.height}
						</dd>
					</div>
					<div className="rounded-xl bg-surface-raised p-3">
						<dt className="text-xs uppercase tracking-wider text-subtle">Starting tiles</dt>
						<dd className="mt-1 font-semibold">
							{project.config.start.board.length +
								project.config.start.inventory.length +
								project.config.start.toolbar.length}
						</dd>
					</div>
				</dl>
			</article>
		</section>
	);
};
