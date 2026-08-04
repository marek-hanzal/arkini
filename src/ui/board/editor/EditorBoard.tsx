import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Describes the reserved engine-backed, non-persistent gameplay sandbox boundary. */
export const EditorBoard = () => {
	const project = useEditorProject();
	const config = project.config;
	return (
		<section
			className="grid h-full min-h-0 place-items-center overflow-y-auto p-3"
			aria-labelledby="editor-board-title"
			data-ui="EditorBoard"
		>
			<article className="w-full max-w-3xl rounded-2xl border-l-2 border-line-strong bg-surface-raised/60 p-6 text-center shadow-xl">
				<h1
					id="editor-board-title"
					className="text-2xl font-semibold"
				>
					Board for {project.title}
				</h1>
				<p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
					{config === undefined
						? "Configure the project root before the temporary gameplay sandbox can start."
						: "The gameplay sandbox is not enabled in this editor foundation. Its boundary is reserved for the same Board, Toolbar, Inventory and game engine with durable saves replaced by a temporary editor session."}
				</p>
				{config === undefined ? null : (
					<dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left text-sm">
						<div className="rounded-xl bg-surface-raised p-3">
							<dt className="text-xs uppercase tracking-wider text-subtle">Board</dt>
							<dd className="mt-1 font-semibold">
								{config.meta.board.width} × {config.meta.board.height}
							</dd>
						</div>
						<div className="rounded-xl bg-surface-raised p-3">
							<dt className="text-xs uppercase tracking-wider text-subtle">
								Starting tiles
							</dt>
							<dd className="mt-1 font-semibold">
								{config.start.board.length +
									config.start.inventory.length +
									config.start.toolbar.length}
							</dd>
						</div>
					</dl>
				)}
			</article>
		</section>
	);
};
