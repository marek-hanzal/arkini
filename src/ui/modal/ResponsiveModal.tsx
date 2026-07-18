import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export namespace ResponsiveModal {
	export interface Props extends PropsWithChildren {
		readonly labelledBy: string;
		readonly className?: string;
		readonly viewTransitionName?: string;
	}
}

/** Renders a content-sized modal panel constrained by its current layout viewport. */
export const ResponsiveModal = ({
	children,
	className,
	labelledBy,
	viewTransitionName,
}: ResponsiveModal.Props) => (
	<section
		role="dialog"
		aria-modal="true"
		aria-labelledby={labelledBy}
		autoFocus
		className={twMerge(
			"max-h-full w-fit min-w-0 max-w-[min(100%,36rem)] overflow-y-auto rounded-2xl border border-line bg-surface/85 p-6 text-foreground shadow-2xl outline-none backdrop-blur-xl",
			className,
		)}
		data-ui="ResponsiveModal"
		style={{
			viewTransitionName,
		}}
		tabIndex={-1}
	>
		{children}
	</section>
);
