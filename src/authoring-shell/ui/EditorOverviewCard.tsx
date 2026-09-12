import type { ReactNode } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

/** Uses the same section header and content surface as authored item details. */
export const EditorOverviewCard = ({
	action,
	body,
	dataUi = "EditorOverviewCard",
	title,
}: {
	readonly action: ReactNode;
	readonly body: ReactNode;
	readonly dataUi?: string;
	readonly title: string;
}) => (
	<section
		className="grid min-w-0 grid-rows-[auto_1fr] gap-[var(--ak-viewport-gap)]"
		data-ui={dataUi}
	>
		<div className="flex items-center gap-3">
			<div className="min-w-0 flex-1">
				<EditorFormSectionDivider title={title} />
			</div>
			<div className="shrink-0">{action}</div>
		</div>
		<EditorRootCard className="content-start">
			<div className="text-sm font-medium leading-snug text-foreground">{body}</div>
		</EditorRootCard>
	</section>
);
