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
		className="grid min-w-0 grid-rows-[auto_1fr] gap-3"
		data-ui={dataUi}
	>
		<EditorFormSectionDivider
			title={title}
			action={action}
		/>
		<EditorRootCard className="content-start">
			<div className="text-sm font-medium leading-snug text-foreground">{body}</div>
		</EditorRootCard>
	</section>
);
