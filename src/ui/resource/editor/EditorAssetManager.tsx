import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRef } from "react";

import { saveEditorAssetsCommandAtom } from "~/bridge/resource/editor/saveEditorAssetsCommandAtom";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button } from "~/ui/button/Button";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";
import { EditorAssetThumbnail } from "~/ui/resource/editor/EditorAssetThumbnail";

/** Lists project PNG resources and publishes selected files immediately. */
export const EditorAssetManager = () => {
	const project = useEditorProject();
	const inputRef = useRef<HTMLInputElement>(null);
	const result = useAtomValue(saveEditorAssetsCommandAtom);
	const saveAssets = useAtomSet(saveEditorAssetsCommandAtom);
	const error = readSettledAsyncResultError(result);
	const pending = result.waiting;
	return (
		<section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[var(--ak-viewport-gap)]">
			<header className="flex min-w-0 flex-wrap items-center gap-3">
				<div className="min-w-0 flex-1">
					<h1 className="text-xl font-semibold">Assets</h1>
					<p className="mt-1 text-sm text-muted">
						{project.resources.length} PNG resources. A matching filename replaces the
						existing asset.
					</p>
				</div>
				<input
					ref={inputRef}
					type="file"
					accept="image/png,.png"
					multiple
					className="sr-only"
					disabled={pending}
					onChange={(event) => {
						const files = Array.from(event.currentTarget.files ?? []);
						event.currentTarget.value = "";
						if (files.length === 0) return;
						saveAssets({
							files,
							projectId: project.projectId,
						});
					}}
				/>
				<Button
					disabled={pending}
					cursorIntent={pending ? "progress" : undefined}
					onClick={() => inputRef.current?.click()}
				>
					{pending ? "Importing…" : "Import assets"}
				</Button>
			</header>
			<div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
				{error === undefined ? null : (
					<p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{error instanceof Error ? error.message : String(error)}
					</p>
				)}
				<div className="ak-list grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{project.resources.map((resource) => (
						<div
							key={resource.id}
							className="ak-list-row flex min-w-0 items-center gap-3 rounded-xl p-3"
						>
							<EditorAssetThumbnail resourceId={resource.id} />
							<span className="min-w-0 truncate font-semibold">{resource.id}</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
};
