import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import type { Placement } from "@floating-ui/react";

import { Tooltip } from "~/ui/overlay/Tooltip";

export interface EditorInfoTooltipProps {
	readonly className?: string;
	readonly content: ReactNode;
	readonly placement?: Placement;
	readonly tooltipClassName?: string;
}

/** Renders the canonical contextual-help affordance used by editor forms. */
export const EditorInfoTooltip = ({
	className,
	content,
	placement,
	tooltipClassName,
}: EditorInfoTooltipProps) => (
	<Tooltip
		content={content}
		contentClassName={tooltipClassName}
		placement={placement}
	>
		<button
			type="button"
			data-ui="EditorInfoTooltip"
			className={twMerge(
				"grid size-8 shrink-0 cursor-help place-items-center rounded-full text-muted hover:text-foreground",
				className,
			)}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<span className="icon-[lucide--info] size-4" />
		</button>
	</Tooltip>
);
