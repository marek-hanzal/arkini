import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";

/** Lists every item from the compiled project as the editor's default workspace. */
export const EditorItemList = () => {
	const project = useEditorProject();
	const items = useMemo(
		() =>
			Object.entries(project.config.items).sort(([, left], [, right]) =>
				left.title.localeCompare(right.title),
			),
		[project.config.items],
	);
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
			aria-labelledby="editor-items-title"
			data-ui="EditorItemList"
		>
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1
						id="editor-items-title"
						className="text-2xl font-semibold"
					>
						Items
					</h1>
					<p className="mt-1 text-sm text-muted">
						{items.length} source-backed item{items.length === 1 ? "" : "s"}
					</p>
				</div>
				<p className="text-xs text-subtle">
					Item editing forms are not enabled in this first workspace.
				</p>
			</header>
			<div className="ak-list grid min-h-0 content-start gap-2 overflow-y-auto overscroll-contain pr-1">
				{items.length === 0 ? (
					<p className="rounded-xl border border-line bg-surface/80 p-4 text-sm text-muted">
						This project does not define any items yet.
					</p>
				) : null}
				{items.map(([id, item]) => (
					<article
						key={id}
						className="ak-list-row flex min-w-0 items-center gap-4 rounded-xl p-3"
						data-item-id={id}
						data-ui="EditorItemRow"
					>
						<EditorItemThumbnail resourceIds={item.asset.default} />
						<div className="min-w-0 flex-1">
							<h2 className="truncate text-base font-semibold">{item.title}</h2>
							<p className="mt-1 truncate text-xs text-subtle">{id}</p>
						</div>
						<span className="shrink-0 rounded-full bg-surface-raised px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
							{item.type}
						</span>
					</article>
				))}
			</div>
		</section>
	);
};
