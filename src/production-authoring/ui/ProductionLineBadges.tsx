import type { LineSchema } from "~/production-line/schema/LineSchema";
import { Tx } from "~/translation/ui/Tx";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Shows the Default and trigger markers of an authored line. */
export const ProductionLineBadges = ({ line }: { readonly line: LineSchema.Type }) => (
	<>
		{line.default ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx label="Default" />
			</span>
		) : null}
		{line.trigger !== LineTriggerEnumSchema.enum.manual ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx
					label={
						line.trigger === LineTriggerEnumSchema.enum["item-termination"]
							? "Item termination"
							: "Clock - Interval"
					}
				/>
			</span>
		) : null}
	</>
);
