import { FileQuestion } from "lucide-react";
import { type DragEvent, useLayoutEffect, useRef, useState } from "react";

import { EditorFormSectionPage } from "~/editor-control/ui/EditorFormSectionPage";
import { EditorAssetSectionHelp } from "~/asset-authoring/ui/EditorAssetSectionHelp";
import { EditorValueLabel } from "~/editor-control/ui/EditorValueControls";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { useEditorAssetEditController } from "~/asset-authoring/ui/useEditorAssetEditController";
import { Status } from "~/ui/ui/Status";

interface EditorAssetEditProps extends useEditorAssetEditController.Props {}

const EditorAssetImageDropZone = ({
	currentUrl,
	error,
	file,
	onFileFn,
}: {
	readonly currentUrl?: string;
	readonly error?: string;
	readonly file?: File;
	readonly onFileFn: (file: File | undefined) => void;
}) => {
	const translator = useTranslator();
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDraggingFn] = useState(false);
	const [selectedUrl, setSelectedUrlFn] = useState<string>();
	useLayoutEffect(() => {
		if (file === undefined) {
			setSelectedUrlFn(undefined);
			return;
		}
		const url = URL.createObjectURL(file);
		setSelectedUrlFn(url);
		return () => URL.revokeObjectURL(url);
	}, [
		file,
	]);
	const selectFn = (next: File | undefined) => onFileFn(next);
	const dropFn = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setDraggingFn(false);
		selectFn(event.dataTransfer.files.item(0) ?? undefined);
	};
	const previewUrl = selectedUrl ?? currentUrl;
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/png,.png"
				className="hidden"
				onChange={(event) => selectFn(event.currentTarget.files?.[0])}
			/>
			<button
				type="button"
				className="grid min-h-48 w-full cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong bg-surface p-6 text-center data-[ui-dragging=true]:border-accent data-[ui-dragging=true]:bg-accent/10 data-[ui-invalid=true]:border-danger data-[ui-invalid=true]:ring-2 data-[ui-invalid=true]:ring-danger/35"
				onClick={() => inputRef.current?.click()}
				onDragEnter={(event) => {
					event.preventDefault();
					setDraggingFn(true);
				}}
				onDragLeave={(event) => {
					event.preventDefault();
					setDraggingFn(false);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDrop={dropFn}
				{...readDataUiFn({
					dataUi: "EditorAssetImageDropZone",
					state: {
						dragging,
						invalid: error !== undefined,
					},
				})}
			>
				<span className="pointer-events-none grid w-full justify-items-center gap-3">
					{previewUrl === undefined ? (
						<span className="text-sm text-muted">
							<Tx label="Preparing asset preview…" />
						</span>
					) : (
						<img
							src={previewUrl}
							alt=""
							className="max-h-64 max-w-full object-contain"
							draggable={false}
						/>
					)}
					<span className="font-semibold">
						{file?.name ?? translator.textFn("Replace image")}
					</span>
				</span>
			</button>
			{error === undefined ? null : (
				<span className="text-xs leading-5 text-danger">{error}</span>
			)}
		</>
	);
};

export const EditorAssetEdit = ({ filter, query, resourceId }: EditorAssetEditProps) => {
	const translator = useTranslator();
	const controller = useEditorAssetEditController({
		filter,
		query,
		resourceId,
	});
	if (!controller.resourceFound)
		return (
			<EditorSectionPage
				header={
					<EditorSectionNavigation
						leading={
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
						title={
							<h1 className="truncate text-xl font-semibold">
								<Tx label="Edit" /> {resourceId}
							</h1>
						}
					/>
				}
			>
				<Status
					dataUi="EditorAssetNotFound"
					description={translator.textFn("This asset is not present in this project.")}
					icon={FileQuestion}
					title={translator.textFn("Asset not found")}
				/>
			</EditorSectionPage>
		);
	return (
		<EditorFormSectionPage
			discardFn={controller.discardFn}
			error={controller.error}
			help={EditorAssetSectionHelp.edit}
			saveEnabled={controller.dirty}
			saveFn={controller.saveFn}
			saving={controller.saving}
			tabs={undefined}
			title={
				<h1 className="truncate text-xl font-semibold">
					<Tx label="Edit" /> {resourceId}
				</h1>
			}
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
		>
			<div className="grid w-full max-w-3xl gap-6">
				<EditorTextControl
					error={controller.assetIdError}
					label={translator.textFn("Asset ID")}
					description={<Mx label="Asset ID help" />}
					onChangeFn={controller.setNextIdFn}
					value={controller.nextId}
				/>
				<div className="grid gap-2">
					<EditorValueLabel
						label={translator.textFn("Image")}
						description={<Mx label="Asset image replacement help" />}
					/>
					<EditorAssetImageDropZone
						currentUrl={controller.currentUrl}
						error={controller.fileError}
						file={controller.file}
						onFileFn={controller.setFileFn}
					/>
				</div>
			</div>
		</EditorFormSectionPage>
	);
};
