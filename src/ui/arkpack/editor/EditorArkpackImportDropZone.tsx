import { useRef, useState, type DragEvent } from "react";
import { twMerge } from "tailwind-merge";

export namespace EditorArkpackImportDropZone {
	export interface Props {
		readonly blocked: boolean;
		readonly pending: boolean;
		readonly onFile: (file: File | undefined) => void;
	}
}

/** Provides one browser-native click and drag-and-drop surface for importing an arkpack. */
export const EditorArkpackImportDropZone = ({
	blocked,
	pending,
	onFile,
}: EditorArkpackImportDropZone.Props) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragDepth, setDragDepth] = useState(0);
	const dragging = dragDepth > 0;
	const resetInput = () => {
		if (inputRef.current !== null) inputRef.current.value = "";
	};
	const selectFile = (file: File | undefined) => {
		if (blocked) return;
		onFile(file);
		resetInput();
	};
	const onDragEnter = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		if (blocked) return;
		setDragDepth((depth) => depth + 1);
	};
	const onDragLeave = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		if (blocked) return;
		setDragDepth((depth) => Math.max(0, depth - 1));
	};
	const onDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setDragDepth(0);
		selectFile(event.dataTransfer.files.item(0) ?? undefined);
	};
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept=".arkpack"
				className="hidden"
				disabled={blocked}
				onChange={(event) => selectFile(event.currentTarget.files?.[0])}
			/>
			<button
				type="button"
				className={twMerge(
					"group grid min-h-44 w-full place-items-center rounded-2xl border border-dashed border-line-strong bg-surface/60 p-6 text-center transition-[border-color,background-color,transform] hover:border-accent hover:bg-accent/10 active:scale-[0.995] disabled:cursor-progress disabled:opacity-60",
					dragging && "border-accent bg-accent/15",
				)}
				disabled={blocked}
				onClick={() => inputRef.current?.click()}
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
				onDragOver={(event) => event.preventDefault()}
				onDrop={onDrop}
				aria-busy={pending}
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
