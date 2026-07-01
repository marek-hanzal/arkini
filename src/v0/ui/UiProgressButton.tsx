import type { CSSProperties, FC, ReactNode } from "react";
import { UiButton } from "~/v0/ui/UiButton";
import { cn } from "~/v0/ui/cn";

export namespace UiProgressButton {
	export interface Props extends Omit<UiButton.Props, "children"> {
		children: ReactNode;
		progress?: number;
	}
}

const clampProgress = (progress: number) => Math.min(1, Math.max(0, progress));

const readProgressFillStyle = (progress: number) =>
	({
		transform: `scaleX(${clampProgress(progress)})`,
	}) satisfies CSSProperties;

export const UiProgressButton: FC<UiProgressButton.Props> = ({
	children,
	className,
	progress,
	tone = "primary",
	...props
}) => {
	const progressFillStyle = progress === undefined ? undefined : readProgressFillStyle(progress);

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
