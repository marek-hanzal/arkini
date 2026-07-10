import { type ChangeEvent, type DragEvent, type FC, useRef, useState } from "react";

import { useDevGamePack } from "../hook/useDevGamePack";

export namespace PackDropzone {
	export interface Props {
		compact?: boolean;
	}
}

export const PackDropzone: FC<PackDropzone.Props> = ({ compact = false }) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const { load, isLoading, error } = useDevGamePack();

	const loadFirstFile = async (files: FileList | null) => {
		const file = files?.[0];
		if (file) {
			try {
				await load(file);
			} catch {
				// The mutation exposes the validation error through the shared pack context.
			}
		}
	};

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		void loadFirstFile(event.currentTarget.files);
		event.currentTarget.value = "";
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(false);
		void loadFirstFile(event.dataTransfer.files);
	};

	return (
		<div className="space-y-3">
			<input
				ref={inputRef}
				type="file"
				accept=".arkpack,application/octet-stream"
				className="sr-only"
				onChange={handleChange}
			/>
			<div
				className={`rounded-2xl border border-dashed transition ${
					isDragging
						? "border-violet-400 bg-violet-500/10"
						: "border-slate-700 bg-slate-900/55 hover:border-slate-500"
				} ${compact ? "p-4" : "p-8 sm:p-10"}`}
				onDragEnter={(event) => {
					event.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={(event) => {
					event.preventDefault();
					setIsDragging(false);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDrop={handleDrop}
			>
				<div
					className={`flex ${compact ? "items-center justify-between gap-4" : "flex-col items-center text-center"}`}
				>
					<div>
						<p className="font-semibold text-slate-100">
							{isLoading ? "Reading game pack…" : "Drop an Arkini game pack here"}
						</p>
						<p
							className={`text-sm text-slate-400 ${compact ? "mt-1" : "mt-2 max-w-xl"}`}
						>
							The file stays in this browser tab. It is gunzipped, decoded, and
							validated against the v1 GameSchema locally.
						</p>
					</div>
					<button
						type="button"
						disabled={isLoading}
						className={`${compact ? "shrink-0" : "mt-6"} rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60`}
						onClick={() => inputRef.current?.click()}
					>
						{isLoading ? "Loading…" : "Choose .arkpack"}
					</button>
				</div>
			</div>
			{error ? (
				<p className="rounded-xl border border-rose-900/70 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
					{error.message}
				</p>
			) : null}
		</div>
	);
};
