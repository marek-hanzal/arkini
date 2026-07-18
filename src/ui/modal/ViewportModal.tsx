import type { PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export namespace ViewportModal {
	export interface Props extends PropsWithChildren {
		readonly labelledBy: string;
		readonly className?: string;
	}
}

/** Renders a modal panel occupying approximately 85% of the current viewport. */
export const ViewportModal = ({ children, className, labelledBy }: ViewportModal.Props) => (
	<section
		role="dialog"
		aria-modal="true"
		aria-labelledby={labelledBy}
		autoFocus
		className={twMerge(
			"h-[85dvh] w-[85dvw] max-h-full max-w-full overflow-auto rounded-2xl border border-line bg-surface/85 p-6 text-foreground shadow-2xl outline-none backdrop-blur-xl",
			className,
		)}
		data-ui="ViewportModal"
		tabIndex={-1}
	>
		{children}
	</section>
);
