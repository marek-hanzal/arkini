import type { ButtonHTMLAttributes, FC, ReactNode } from "react";
import { cn } from "~/ui/cn";

export namespace UiButton {
	export type Tone = "primary" | "secondary" | "ghost" | "danger";

	export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
		children: ReactNode;
		tone?: Tone;
		fullWidth?: boolean;
	}
}

const toneClassName: Record<UiButton.Tone, string> = {
	danger: "border-rose-300/70 bg-rose-100 text-rose-800 shadow-[0_6px_16px_rgba(244,63,94,0.12)] hover:border-rose-400 hover:bg-rose-200",
	ghost: "border-violet-200/70 bg-white/55 text-ak-text shadow-[0_8px_18px_rgba(168,85,247,0.10)] hover:border-ak-border-accent hover:bg-ak-primary-soft",
	primary:
		"border-pink-300/95 bg-ak-primary text-white shadow-[0_10px_24px_rgba(236,72,153,0.24),inset_0_1px_0_rgba(255,255,255,0.28)] hover:border-pink-200 hover:bg-pink-400",
	secondary:
		"border-violet-200/80 bg-ak-primary-soft text-ak-text shadow-[0_8px_18px_rgba(168,85,247,0.12),inset_0_1px_0_rgba(255,255,255,0.55)] hover:border-ak-border-accent hover:bg-pink-100",
};

export const UiButton: FC<UiButton.Props> = ({
	children,
	className,
	fullWidth = true,
	tone = "secondary",
	type = "button",
	...props
}) => (
	<button
		type={type}
		className={cn(
			"min-h-10 rounded-sm border px-3 py-2 text-sm font-extrabold leading-none transition-[transform,border-color,background,color,opacity,box-shadow] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
			fullWidth && "w-full",
			toneClassName[tone],
			className,
		)}
		{...props}
	>
		{children}
	</button>
);
