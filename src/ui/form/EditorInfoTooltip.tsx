import type { ReactNode } from "react";

import { Tooltip } from "~/ui/overlay/Tooltip";

/** Renders the canonical contextual-help affordance used by editor forms. */
export const EditorInfoTooltip = ({ content }: { readonly content: ReactNode }) => (
	<Tooltip content={content}>
		<button
			type="button"
			data-ui="EditorInfoTooltip"
			className="grid size-8 shrink-0 cursor-help place-items-center rounded-full text-muted hover:text-foreground"
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
		>
			<span className="icon-[lucide--info] size-4" />
		</button>
	</Tooltip>
);
