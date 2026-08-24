import { twMerge } from "tailwind-merge";

import { useController } from "~/ui/arkpack/editor/useController";

export namespace EditorArkpackImportDropZone {
	export interface Props extends useController.Props {
		readonly pending: boolean;
	}
}

/** Provides one browser-native click and drag-and-drop surface for importing an arkpack. */
export const EditorArkpackImportDropZone = ({
	blocked,
	pending,
	onFile,
}: EditorArkpackImportDropZone.Props) => {
	const controller = useController({
		blocked,
		onFile,
	});
	return (
		<>
			<input
				ref={controller.inputRef}
				type="file"
				accept=".arkpack"
				className="hidden"
				disabled={blocked}
				onChange={(event) => controller.selectFile(event.currentTarget.files?.[0])}
			/>
			<button
				type="button"
				className={twMerge(
					"group grid min-h-44 w-full place-items-center rounded-2xl border border-dashed border-line-strong bg-surface/60 p-6 text-center transition-[border-color,background-color,transform] hover:border-accent hover:bg-accent/10 active:scale-[0.995] disabled:cursor-progress disabled:opacity-60",
					controller.dragging && "border-accent bg-accent/15",
				)}
				disabled={blocked}
				onClick={controller.openPicker}
				onDragEnter={(event) => {
					event.preventDefault();
					controller.enterDrag();
				}}
				onDragLeave={(event) => {
					event.preventDefault();
					controller.leaveDrag();
				}}
				onDragOver={(event) => event.preventDefault()}
				onDrop={(event) => {
					event.preventDefault();
					controller.dropFile(event.dataTransfer.files.item(0) ?? undefined);
				}}
				data-ui="EditorArkpackImportDropZone"
			>
				<span className="grid justify-items-center gap-3 pointer-events-none">
					<span className="icon-[lucide--package-open] size-9 text-accent" />
					<span>
						<span className="block text-lg font-semibold">
							{pending ? "Importing arkpack…" : "Import arkpack"}
						</span>
						<span className="mt-1 block text-sm text-muted">
							Drop a .arkpack file here or click to choose one
						</span>
					</span>
				</span>
			</button>
		</>
	);
};
