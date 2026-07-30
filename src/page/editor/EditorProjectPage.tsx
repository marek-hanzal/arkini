import { EditorProjectDirectoryButton } from "~/ui/editor/EditorProjectDirectoryButton";
import { EditorMetaOverview } from "~/ui/meta/editor/EditorMetaOverview";
import { EditorResourceOverview } from "~/ui/resource/editor/EditorResourceOverview";

export const EditorProjectPage = () => (
	<section
		className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]"
		aria-labelledby="editor-project-title"
		data-ui="EditorProjectPage"
	>
		<header className="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1
					id="editor-project-title"
					className="text-2xl font-semibold"
				>
					Project
				</h1>
				<p className="mt-1 text-sm text-muted">
					Game-wide metadata, layout and shell resources.
				</p>
			</div>
			<EditorProjectDirectoryButton />
		</header>
		<div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)]">
				<EditorMetaOverview />
				<EditorResourceOverview />
			</div>
		</div>
	</section>
);
