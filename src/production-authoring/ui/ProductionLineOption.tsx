import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ProductionLineBadges } from "~/production-authoring/ui/ProductionLineBadges";

/** Identifies a selectable line and its independent manual and automatic roles. */
export const ProductionLineOption = ({
	line,
	label,
}: {
	readonly line: LineSchema.Type;
	readonly label: string;
}) => (
	<span
		className="flex min-w-0 flex-1 items-center gap-2"
		data-ui="EditorProductionLineOption"
	>
		<span className="truncate text-sm font-semibold text-foreground">{label}</span>
		<ProductionLineBadges line={line} />
	</span>
);
