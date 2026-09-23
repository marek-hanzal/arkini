import { Overlay } from "~/ui/ui/Overlay";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { useEditorResourceMetadataEditController } from "~/resource-authoring/ui/useEditorResourceMetadataEditController";
import { Effect } from "effect";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { ImagePlus, Pencil } from "lucide-react";
import { type ChangeEventHandler, useRef, useState, useCallback } from "react";

import { EditorResourceThumbnail } from "~/authoring-form/ui/EditorResourceThumbnail";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { importEditorResourcesFx } from "~/resource-authoring/fx/importEditorResourcesFx";
import type { Project } from "~/project-authoring/type/Project";
import { Button, PrimaryButton } from "~/ui/ui/Button";
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

const ProjectImageTitleEditor = ({
	resource,
	closeFn,
}: {
	readonly resource: Project.Resource;
	readonly closeFn: () => void;
}) => {
	const translator = useTranslator();
	const controller = useEditorResourceMetadataEditController({
		resource,
		type: "image",
		closeFn,
	});
	return (
		<Overlay onCloseFn={() => void controller.requestCloseFn()}>
			<div
				data-ui="ProjectImageTitleEditor"
				className="grid w-full max-w-md gap-4 rounded-2xl border border-line-strong bg-modal p-6 text-foreground shadow-2xl"
			>
				<EditorTextControl
					label={translator.textFn("Title")}
					value={controller.title}
					onChangeFn={controller.setTitleFn}
					error={controller.titleError}
					readOnly={controller.saving}
				/>
				{controller.error === undefined ? null : (
					<p className="text-sm text-danger">{String(controller.error)}</p>
				)}
				<div className="flex justify-end gap-2">
					<Button
						disabled={controller.saving}
						onClick={() => void controller.discardFn()}
					>
						{translator.textFn("Discard")}
					</Button>
					<PrimaryButton
						disabled={!controller.dirty || controller.saving}
						onClick={() => void controller.saveFn()}
					>
						{translator.textFn("Save")}
					</PrimaryButton>
				</div>
			</div>
		</Overlay>
	);
};

/** Owns the small general-image library used by launcher and shell configuration. */
export const ProjectImageLibrary = ({ project }: { readonly project: Project }) => {
	const translator = useTranslator();
	const inputRef = useRef<HTMLInputElement>(null);
	const [editingUid, setEditingUidFn] = useState<string>();
	const closeEditorFn = useCallback(() => setEditingUidFn(undefined), []);
	const editingResource = project.resources.find((resource) => resource.uid === editingUid);
	const result = useAtomValue(importProjectImagesAtom);
	const importImagesFn = useAtomSet(importProjectImagesAtom);
	const pending = result.waiting;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const importedCount =
		AsyncResult.isSuccess(result) && !pending ? result.value.resourceUids.length : 0;
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
			<ul className="grid grid-cols-3 gap-3">
				{images.map((resource) => (
					<li
						className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-canvas/50 p-3"
						key={resource.uid}
					>
						<EditorResourceThumbnail
							resourceUid={resource.uid}
							size="sm"
						/>
						<span className="min-w-0 flex-1 truncate text-sm">{resource.title}</span>
						<Button onClick={() => setEditingUidFn(resource.uid)}>
							<Pencil className="size-4" />
							{translator.textFn("Edit")}
						</Button>
					</li>
				))}
			</ul>
			{editingResource === undefined ? null : (
				<ProjectImageTitleEditor
					key={editingResource.uid}
					resource={editingResource}
					closeFn={closeEditorFn}
				/>
			)}
		</section>
	);
};
