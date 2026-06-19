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
	danger: "border-rose-500/20 bg-rose-500/10 text-rose-200 hover:border-rose-400/35 hover:bg-rose-500/14",
	ghost: "border-ak-border bg-ak-surface text-ak-text hover:border-ak-border-accent hover:bg-white/[0.035]",
	primary:
		"border-ak-border-accent bg-ak-primary text-white hover:bg-fuchsia-400 hover:border-fuchsia-300",
	secondary:
		"border-ak-border bg-ak-surface-soft text-ak-text hover:border-ak-border-accent hover:bg-ak-primary-soft",
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
			"min-h-10 rounded-sm border px-3 py-2 text-sm font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
			fullWidth && "w-full",
			toneClassName[tone],
			className,
		)}
		{...props}
	>
		{children}
	</button>
);
