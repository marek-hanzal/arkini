import { match } from "ts-pattern";
import { Music, Pause, Play } from "lucide-react";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

/** Compact seekable audio surface shared by resource and item authoring. */
export const EditorAudioPreviewPlayer = ({
	disabled = false,
	fill = false,
	error,
	placeholder,
	trackName,
	progress,
	playing,
	seekFn,
	toggleFn,
}: {
	readonly disabled?: boolean;
	readonly fill?: boolean;
	readonly error?: string;
	readonly placeholder?: string;
	readonly trackName?: string;
	readonly progress: number;
	readonly playing: boolean;
	readonly seekFn: (progress: number) => void;
	readonly toggleFn: () => void;
}) => {
	return (
		<div
			data-ui="EditorAudioPreview"
			className="flex h-[var(--ak-control-min-height)] items-center gap-3"
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
				className="relative flex h-full w-64 cursor-pointer items-center justify-end overflow-hidden rounded-lg border border-secondary-border bg-secondary-subtle text-secondary-foreground transition-colors data-[ui-fill=true]:min-w-0 data-[ui-fill=true]:flex-1 data-[ui-disabled=true]:cursor-default"
				onClick={(event) => {
					if (disabled) return;
					const bounds = event.currentTarget.getBoundingClientRect();
					seekFn((event.clientX - bounds.left) / bounds.width);
				}}
			>
				<div
					data-ui="EditorAudioPreviewProgress"
					className="pointer-events-none absolute inset-y-0 left-0 bg-secondary-selected transition-[width] duration-200 ease-linear"
					style={{
						width: `${progress * 100}%`,
					}}
				/>
				{trackName || placeholder ? (
					<span
						className="relative min-w-0 flex-1 truncate px-3 text-sm data-[ui-placeholder=true]:text-subtle"
						{...readDataUiFn({
							dataUi: "EditorAudioPreviewLabel",
							state: {
								placeholder: trackName === undefined,
							},
						})}
					>
						{trackName ?? placeholder}
					</span>
				) : null}
				<LinkButton
					disabled={disabled}
					className="relative grid h-full w-[var(--ak-control-min-height)] shrink-0 place-items-center text-secondary-foreground transition-colors enabled:hover:bg-secondary-hover"
					data-ui="EditorAudioPreviewToggle"
					onClick={(event) => {
						event.stopPropagation();
						toggleFn();
					}}
				>
					{match({
						placeholder: Boolean(placeholder),
						playing,
					})
						.with(
							{
								placeholder: true,
							},
							() => <Music className="size-4" />,
						)
						.with(
							{
								playing: true,
							},
							() => <Pause className="size-4" />,
						)
						.otherwise(() => (
							<Play className="size-4" />
						))}
				</LinkButton>
			</div>
		</div>
	);
};
