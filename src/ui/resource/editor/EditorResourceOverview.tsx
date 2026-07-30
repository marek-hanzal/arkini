import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

/** Presents the hero and embedded PNG inventory owned by the resource domain. */
export const EditorResourceOverview = () => {
	const project = useEditorProject();
	const heroResourceId = project.config?.resources.hero;
	const heroUrl = useEditorResourceUrl(heroResourceId);
	return (
		<>
			<article
				className="rounded-2xl border border-line bg-surface/85 p-5"
				data-ui="EditorResourceHeroOverview"
			>
				<h2 className="text-lg font-semibold">Hero image</h2>
				<div className="mt-4 grid min-h-52 place-items-center overflow-hidden rounded-xl border border-line bg-canvas/70 p-4">
					{heroResourceId === undefined ? (
						<p className="text-sm text-muted">Project resources are not configured yet.</p>
					) : heroUrl === undefined ? (
						<p className="text-sm text-muted">Preparing hero preview…</p>
					) : (
						<img
							src={heroUrl}
							alt={`${project.title} hero`}
							className="max-h-56 max-w-full object-contain"
							draggable={false}
						/>
					)}
				</div>
				{heroResourceId === undefined ? null : (
					<p className="mt-3 break-all text-xs text-subtle">Resource: {heroResourceId}</p>
				)}
			</article>
			<article
				className="rounded-2xl border border-line bg-surface/85 p-5 lg:col-span-2"
				data-ui="EditorResourceListOverview"
			>
				<h2 className="text-lg font-semibold">Resources</h2>
				<p className="mt-1 text-sm text-muted">
					{project.resources.length} PNG file{project.resources.length === 1 ? "" : "s"}
				</p>
				<ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{project.resources.map((resource) => (
						<li
							key={resource.id}
							className="truncate rounded-lg bg-surface-raised px-3 py-2 font-mono text-xs text-muted"
						>
							{resource.id}
						</li>
					))}
				</ul>
			</article>
		</>
	);
};
