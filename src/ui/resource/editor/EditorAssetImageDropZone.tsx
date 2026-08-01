import { useLayoutEffect, useRef, useState, type DragEvent } from "react";

export const EditorAssetImageDropZone = ({
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
