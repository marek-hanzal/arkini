import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";

/** Keeps Editor overview summaries visually consistent across authored domains. */
export const EditorOverviewCard = ({
	body,
	dataUi,
	footerLeft,
	footerRight,
	icon: Icon,
	title,
}: {
	readonly body: ReactNode;
	readonly dataUi?: string;
	readonly footerLeft?: ReactNode;
	readonly footerRight?: ReactNode;
	readonly icon?: LucideIcon;
	readonly title: ReactNode;
}) => (
	<EditorRootCard
		className="gap-4"
		dataUi={dataUi}
	>
		<h2 className="flex items-center gap-2 text-lg font-semibold">
			{Icon === undefined ? null : <Icon className="size-4" />}
			{title}
		</h2>
		<div className="text-sm font-medium leading-snug text-foreground">{body}</div>
		{footerLeft === undefined && footerRight === undefined ? null : (
			<div className="flex items-end justify-between gap-4">
				<div>{footerLeft}</div>
				<div className="ml-auto">{footerRight}</div>
			</div>
		)}
	</EditorRootCard>
);
