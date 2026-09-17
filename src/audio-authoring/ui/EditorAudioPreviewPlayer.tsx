import { Pause, Play } from "lucide-react";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Compact seekable audio surface shared by resource and item authoring. */
export const EditorAudioPreviewPlayer = ({
	disabled = false,
	fill = false,
	error,
	progress,
	playing,
	seekFn,
	toggleFn,
}: {
	readonly disabled?: boolean;
	readonly fill?: boolean;
	readonly error?: string;
	readonly progress: number;
	readonly playing: boolean;
	readonly seekFn: (progress: number) => void;
	readonly toggleFn: () => void;
}) => {
	return (
		<div
			data-ui="EditorAudioPreview"
			className="flex h-9 items-center gap-3"
		>
			{error === undefined ? null : (
				<p
					className="max-w-64 truncate text-xs text-danger"
					title={error}
				>
					{error}
				</p>
			)}
			<div
				{...readDataUiFn({
					dataUi: "EditorAudioPreviewSeek",
					state: {
						disabled,
						fill,
					},
				})}
				className="relative flex h-[75%] w-64 cursor-pointer items-center justify-end overflow-hidden rounded-md bg-surface-raised data-[ui-fill=true]:min-w-0 data-[ui-fill=true]:flex-1 data-[ui-disabled=true]:cursor-default data-[ui-disabled=true]:grayscale"
				onClick={(event) => {
					if (disabled) return;
					const bounds = event.currentTarget.getBoundingClientRect();
					seekFn((event.clientX - bounds.left) / bounds.width);
				}}
			>
				<div
					data-ui="EditorAudioPreviewProgress"
					className="pointer-events-none absolute inset-y-0 left-0 bg-[var(--ak-list-row-active-progress-surface)] transition-[width] duration-200 ease-linear"
					style={{
						width: `${progress * 100}%`,
					}}
				/>
				<LinkButton
					disabled={disabled}
					className="relative grid h-full w-9 shrink-0 place-items-center text-foreground"
					data-ui="EditorAudioPreviewToggle"
					onClick={(event) => {
						event.stopPropagation();
						toggleFn();
					}}
				>
					{playing ? <Pause className="size-4" /> : <Play className="size-4" />}
				</LinkButton>
			</div>
		</div>
	);
};
