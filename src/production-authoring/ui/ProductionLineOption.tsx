import type { LineSchema } from "~/production-line/schema/LineSchema";
import { Tx } from "~/translation/ui/Tx";

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
		{line.default ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-foreground">
				<Tx label="Default" />
			</span>
		) : null}
		{line.clock === true ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium text-foreground">
				<Tx label="Clock" />
			</span>
		) : null}
	</span>
);
