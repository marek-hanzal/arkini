import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink, PrimaryButtonLink } from "~/ui/button/Button";
import { EditorItemNotFound } from "~/ui/item/editor/EditorItemNotFound";
import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemByUid } from "~/ui/item/editor/useEditorItemByUid";

/** Shows one canonical item without creating editable state. */
export const EditorItemView = ({ uid }: { readonly uid: string }) => {
	const project = useEditorProject();
	const item = useEditorItemByUid(uid);
	if (item === undefined) return <EditorItemNotFound uid={uid} />;
	return (
		<section
			className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
			aria-labelledby="editor-item-view-title"
			data-ui="EditorItemView"
		>
			<header className="flex min-w-0 flex-wrap items-center gap-3">
				<ButtonLink
					to="/editor/$projectId/editor/items/list"
					params={{
						projectId: project.projectId,
					}}
					className="min-h-0 px-3 py-2"
					aria-label="Back to items"
				>
					<span className="icon-[lucide--arrow-left] size-4" />
				</ButtonLink>
				<div className="min-w-0 flex-1">
					<h1
						id="editor-item-view-title"
						className="truncate text-xl font-semibold"
					>
						{item.title || item.id}
					</h1>
					<p className="mt-1 text-xs uppercase tracking-wider text-muted">{item.type}</p>
				</div>
				<PrimaryButtonLink
					to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
					params={{
						projectId: project.projectId,
						itemUid: item.uid,
						sectionId: "identity",
					}}
					className="min-h-0 gap-2 px-4 py-2 text-sm"
				>
					<span className="icon-[lucide--pencil] size-4" />
					Edit
				</PrimaryButtonLink>
			</header>
			<div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
				<div className="mx-auto grid w-full max-w-5xl gap-4 pb-8">
					<article className="grid gap-5 rounded-2xl border border-line bg-surface/85 p-5 md:grid-cols-[auto_minmax(0,1fr)]">
						<EditorItemThumbnail resourceIds={item.asset.default} />
						<div className="min-w-0">
							<p className="text-sm leading-6 text-muted">
								{item.description || "No player-facing description."}
							</p>
							<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
								<div>
									<dt className="text-xs uppercase tracking-wider text-subtle">
										ID
									</dt>
									<dd className="mt-1 break-all font-mono text-foreground">
										{item.id}
									</dd>
								</div>
								<div>
									<dt className="text-xs uppercase tracking-wider text-subtle">
										UID
									</dt>
									<dd className="mt-1 break-all font-mono text-foreground">
										{item.uid}
									</dd>
								</div>
								<div>
									<dt className="text-xs uppercase tracking-wider text-subtle">
										Category
									</dt>
									<dd className="mt-1 text-foreground">{item.categoryId}</dd>
								</div>
								<div>
									<dt className="text-xs uppercase tracking-wider text-subtle">
										Scope
									</dt>
									<dd className="mt-1 text-foreground">{item.scope}</dd>
								</div>
							</dl>
							{item.tags.length === 0 ? null : (
								<div className="mt-4 flex flex-wrap gap-2">
									{item.tags.map((tag) => (
										<span
											key={tag}
											className="rounded-full bg-surface-raised px-2.5 py-1 text-xs text-muted"
										>
											{tag}
										</span>
									))}
								</div>
							)}
						</div>
					</article>
					<article className="rounded-2xl border border-line bg-surface/85 p-5">
						<h2 className="text-lg font-semibold">Definition</h2>
						<pre className="mt-4 overflow-x-auto rounded-xl bg-canvas/70 p-4 text-xs leading-5 text-muted">
							{JSON.stringify(item, null, 2)}
						</pre>
					</article>
				</div>
			</div>
		</section>
	);
};
