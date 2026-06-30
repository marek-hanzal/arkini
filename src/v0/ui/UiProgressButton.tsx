import type { CSSProperties, FC, ReactNode } from "react";
import { UiButton } from "~/v0/ui/UiButton";
import { cn } from "~/v0/ui/cn";

export namespace UiProgressButton {
	export interface Props extends Omit<UiButton.Props, "children"> {
		children: ReactNode;
		progress?: number;
		progressAutoCompleteMs?: number;
		progressAutoCompleteTo?: "empty" | "full";
	}
}

const clampProgress = (progress: number) => Math.min(1, Math.max(0, progress));

const readProgressFillStyle = ({
	progress,
	progressAutoCompleteMs,
	progressAutoCompleteTo = "full",
}: {
	progress: number;
	progressAutoCompleteMs?: number;
	progressAutoCompleteTo?: "empty" | "full";
}) => {
	const clampedProgress = clampProgress(progress);
	const shouldAutoComplete =
		progressAutoCompleteMs !== undefined &&
		progressAutoCompleteMs > 0 &&
		(progressAutoCompleteTo === "empty" ? clampedProgress > 0 : clampedProgress < 1);

	const autoCompleteAnimation =
		progressAutoCompleteTo === "empty"
			? "ui-progress-button-empty-to-start"
			: "ui-progress-button-fill-to-end";

	return {
		"--ui-progress-button-start": clampedProgress,
		animation: shouldAutoComplete
			? `${autoCompleteAnimation} ${Math.ceil(progressAutoCompleteMs)}ms linear forwards`
			: undefined,
		transform: `scaleX(${clampedProgress})`,
	} satisfies CSSProperties & Record<"--ui-progress-button-start", number>;
};

export const UiProgressButton: FC<UiProgressButton.Props> = ({
	children,
	className,
	progress,
	progressAutoCompleteMs,
	progressAutoCompleteTo = "full",
	tone = "primary",
	...props
}) => {
	const progressFillStyle =
		progress === undefined
			? undefined
			: readProgressFillStyle({
					progress,
					progressAutoCompleteMs,
					progressAutoCompleteTo,
				});

	return (
		<UiButton
			className={cn("relative overflow-hidden", className)}
			tone={tone}
			{...props}
		>
			{progressFillStyle !== undefined ? (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0 origin-left bg-white/20 transition-transform duration-200 ease-linear"
					style={progressFillStyle}
				/>
			) : null}
			<span className="relative">{children}</span>
		</UiButton>
	);
};
