import type { ButtonHTMLAttributes, FC, ReactNode } from "react";
import { cn } from "~/v0/ui/cn";

export namespace UiButton {
	export type Tone = "primary" | "secondary" | "ghost" | "danger";

	export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
		children: ReactNode;
		tone?: Tone;
		fullWidth?: boolean;
	}
}

const toneClassName: Record<UiButton.Tone, string> = {
	danger: "border-rose-400/45 bg-rose-500/15 text-rose-100 shadow-[0_0_0_1px_rgba(244,63,94,0.08)] hover:border-rose-300/60 hover:bg-rose-500/22",
	ghost: "border-violet-300/20 bg-violet-300/8 text-ak-text shadow-[0_0_0_1px_rgba(255,255,255,0.03)] hover:border-ak-border-accent hover:bg-ak-primary-soft",
	primary:
		"border-fuchsia-300/75 bg-ak-primary text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(236,72,153,0.18)] hover:border-fuchsia-200 hover:bg-fuchsia-400",
	secondary:
		"border-violet-300/35 bg-ak-primary-soft text-ak-text shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:border-ak-border-accent hover:bg-fuchsia-400/18",
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
