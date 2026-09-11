import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Tooltip } from "~/ui/ui/Tooltip";

interface EditorInfoTooltipProps {
	readonly content: ReactNode;
}

/** Renders the canonical contextual-help affordance used by editor forms. */
export const EditorInfoTooltip = ({ content }: EditorInfoTooltipProps) => (
	<Tooltip content={content}>
		<button
			type="button"
			data-ui="EditorInfoTooltip"
			className="grid size-5 min-h-0 min-w-0 shrink-0 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-muted hover:text-foreground"
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<Info className="size-4" />
		</button>
	</Tooltip>
);
