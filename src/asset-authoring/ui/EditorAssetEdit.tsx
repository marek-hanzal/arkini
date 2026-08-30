import { FileQuestion } from "lucide-react";
import { type DragEvent, useLayoutEffect, useRef, useState } from "react";

import { PrimaryButton } from "~/ui/button/Button";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { editorInputClassName } from "~/ui/form/EditorInputClassName";
import { EditorFormContent } from "~/ui/form/EditorFormContent";
import { useEditorAssetEditController } from "~/asset-authoring/ui/useEditorAssetEditController";
import { Status } from "~/ui/status/Status";

interface EditorAssetEditProps extends useEditorAssetEditController.Props {}

const EditorAssetImageDropZone = ({
	currentUrl,
	file,
	onFile,
}: {
	readonly currentUrl?: string;
	readonly file?: File;
	readonly onFile: (file: File | undefined) => void;
}) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [selectedUrl, setSelectedUrl] = useState<string>();
	useLayoutEffect(() => {
		if (file === undefined) {
			setSelectedUrl(undefined);
			return;
		}
		const url = URL.createObjectURL(file);
		setSelectedUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [
		file,
	]);
	const select = (next: File | undefined) => onFile(next);
	const drop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setDragging(false);
		select(event.dataTransfer.files.item(0) ?? undefined);
	};
	const previewUrl = selectedUrl ?? currentUrl;
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/png,.png"
				className="sr-only"
				onChange={(event) => select(event.currentTarget.files?.[0])}
			/>
			<button
				type="button"
				className={`grid min-h-48 w-full cursor-pointer place-items-center rounded-xl border border-dashed p-6 text-center ${dragging ? "border-accent bg-accent/10" : "border-line-strong bg-surface"}`}
				onClick={() => inputRef.current?.click()}
				onDragEnter={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={(event) => {
					event.preventDefault();
					setDragging(false);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDrop={drop}
				data-ui="EditorAssetImageDropZone"
			>
				<span className="pointer-events-none grid w-full justify-items-center gap-3">
					{previewUrl === undefined ? (
						<span className="text-sm text-muted">Preparing asset preview…</span>
					) : (
						<img
							src={previewUrl}
							alt=""
							className="max-h-64 max-w-full object-contain"
							draggable={false}
						/>
					)}
					<span className="font-semibold">{file?.name ?? "Replace image"}</span>
					<span className="text-sm text-muted">
						Drop a PNG here or click to choose one
					</span>
				</span>
			</button>
		</>
	);
};

export const EditorAssetEdit = ({ filter, query, resourceId }: EditorAssetEditProps) => {
	const controller = useEditorAssetEditController({
		filter,
		query,
		resourceId,
	});
	if (!controller.resourceFound)
		return (
			<Status
				dataUi="EditorAssetNotFound"
				description={`Resource ${resourceId} is not present in this project.`}
				icon={FileQuestion}
				title="Asset not found"
				action={
					<EditorHistoryBackButton
						params={{
							projectId: controller.projectId,
						}}
						search={{
							filter,
							query,
						}}
						to="/editor/$projectId/assets"
					/>
				}
			/>
		);
	return (
		<EditorSectionPage
			tabs={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/assets/$resourceId/detail/overview"
							params={{
								projectId: controller.projectId,
								resourceId,
							}}
							search={{
								filter,
								query,
							}}
						/>
					}
					title={<h1 className="truncate text-xl font-semibold">Edit {resourceId}</h1>}
					action={
						<PrimaryButton
							disabled={!controller.dirty || controller.saving}
							cursorIntent={controller.saving ? "progress" : undefined}
							className="min-h-0 px-4 py-2 text-sm"
							onClick={() => void controller.save()}
						>
							Save
						</PrimaryButton>
					}
				/>
			}
		>
			<div className="mx-auto w-full max-w-3xl">
				<EditorFormContent
					error={controller.error}
					save={controller.save}
				>
					<label className="grid gap-1.5 text-sm font-semibold">
						Asset ID
						<input
							className={editorInputClassName}
							value={controller.nextId}
							onChange={(event) => controller.setNextId(event.currentTarget.value)}
						/>
					</label>
					<EditorAssetImageDropZone
						currentUrl={controller.currentUrl}
						file={controller.file}
						onFile={controller.setFile}
					/>
				</EditorFormContent>
			</div>
		</EditorSectionPage>
	);
};
