import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";

import { saveEditorAssetMutationFx } from "~/bridge/editor/saveEditorAssetMutation";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { Button } from "~/ui/button/Button";
import { EditorAssetThumbnail } from "~/ui/resource/editor/EditorAssetThumbnail";

/** Lists project PNG resources and publishes selected files immediately. */
export const EditorAssetManager = () => {
	const project = useEditorProject();
	const inputRef = useRef<HTMLInputElement>(null);
	const mutation = useMutation({
		mutationKey: [
			"editor",
			project.projectId,
			"asset",
		],
		mutationFn: (file: File) =>
			RendererRuntime.runPromise(
				saveEditorAssetMutationFx({
					expectedRevision: project.revision,
					file,
					projectId: project.projectId,
				}),
			),
	});
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
					className="sr-only"
					disabled={mutation.isPending}
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						event.currentTarget.value = "";
						if (file === undefined) return;
						mutation.mutate(file);
					}}
				/>
				<Button
					disabled={mutation.isPending}
					cursorIntent={mutation.isPending ? "progress" : undefined}
					onClick={() => inputRef.current?.click()}
				>
					{mutation.isPending ? "Saving…" : "Add or replace PNG"}
				</Button>
			</header>
			<div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
				{mutation.error === null ? null : (
					<p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
						{mutation.error instanceof Error
							? mutation.error.message
							: String(mutation.error)}
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
