import type { FC, ReactNode } from "react";
import { UiButton } from "~/v0/ui/UiButton";
import { cn } from "~/v0/ui/cn";

export namespace UiProgressButton {
	export interface Props extends Omit<UiButton.Props, "children"> {
		children: ReactNode;
		progress?: number;
	}
}

const clampProgress = (progress: number) => Math.min(1, Math.max(0, progress));

export const UiProgressButton: FC<UiProgressButton.Props> = ({
	children,
	className,
	progress,
	tone = "primary",
	...props
}) => {
	const progressPercent = progress === undefined ? undefined : clampProgress(progress) * 100;

	return (
		<UiButton
			className={cn("relative overflow-hidden disabled:opacity-100", className)}
			tone={tone}
			{...props}
		>
			{progressPercent !== undefined ? (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-200 ease-linear"
					style={{
						width: `${progressPercent}%`,
					}}
				/>
			) : null}
			<span className="relative">{children}</span>
		</UiButton>
	);
};
