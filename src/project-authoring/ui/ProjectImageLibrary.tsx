import { Effect } from "effect";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { ImagePlus } from "lucide-react";
import { type ChangeEventHandler, useRef } from "react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { importEditorResourcesFx } from "~/resource-authoring/fx/importEditorResourcesFx";
import type { Project } from "~/project-authoring/type/Project";
import { PrimaryButton } from "~/ui/ui/Button";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useTranslator } from "~/translation/ui/useTranslator";

const importProjectImagesAtom = RendererRuntime.runSync(
	Effect.map(ProjectWriteAdmission, (admission) =>
		Atom.fn(
			({
				files,
				projectId,
			}: {
				readonly files: ReadonlyArray<File>;
				readonly projectId: string;
			}) =>
				importEditorResourcesFx({
					files,
					projectId,
					source: "files",
					type: "image",
				}).pipe(Effect.provideService(ProjectWriteAdmission, admission)),
		).pipe(Atom.withLabel("ProjectImageImport"), Atom.setIdleTTL(0)),
	),
);

/** Owns the small general-image library used by launcher and shell configuration. */
export const ProjectImageLibrary = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const inputRef = useRef<HTMLInputElement>(null);
	const result = useAtomValue(importProjectImagesAtom);
	const importImagesFn = useAtomSet(importProjectImagesAtom);
	const pending = result.waiting;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const importedCount =
		AsyncResult.isSuccess(result) && !pending ? result.value.resourceIds.length : 0;
	const images = project.resources.filter(({ type }) => type === "image");
	const onChangeFn: ChangeEventHandler<HTMLInputElement> = (event) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = "";
		if (files.length === 0) return;
		importImagesFn({
			files,
			projectId: project.projectId,
		});
	};

	return (
		<section
			className="grid gap-4"
			data-ui="EditorProjectImageLibrary"
		>
			<header className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold">{translator.textFn("Images")}</h2>
					<p className="text-sm text-muted">
						{translator.textFn("General PNG images keep their original dimensions.")}
					</p>
				</div>
				<PrimaryButton
					className="gap-2"
					cursorIntent={pending ? "progress" : undefined}
					disabled={pending}
					onClick={() => inputRef.current?.click()}
				>
					<ImagePlus className="size-4" />
					{translator.textFn("Import images")}
				</PrimaryButton>
				<input
					ref={inputRef}
					className="hidden"
					type="file"
					accept="image/png,.png"
					multiple
					onChange={onChangeFn}
				/>
			</header>
			{error === undefined ? null : <p className="text-sm text-danger">{String(error)}</p>}
			{importedCount === 0 ? null : (
				<p className="text-sm text-success">
					{translator
						.textFn("Imported image count")
						.replace("{count}", String(importedCount))}
				</p>
			)}
			<ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
				{images.map((resource) => (
					<li
						className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-canvas/50 p-3"
						key={resource.id}
					>
						<EditorResourceThumbnail
							resourceId={resource.id}
							size="sm"
						/>
						<span className="truncate font-mono text-sm">{resource.id}</span>
					</li>
				))}
			</ul>
		</section>
	);
};
