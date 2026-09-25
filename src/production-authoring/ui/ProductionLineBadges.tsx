import type { LineSchema } from "~/production-line/schema/LineSchema";
import { Tx } from "~/translation/ui/Tx";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** Shows the Default and Clock markers of an authored line. */
export const ProductionLineBadges = ({ line }: { readonly line: LineSchema.Type }) => (
	<>
		{line.default ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx label="Default" />
			</span>
		) : null}
		{line.clock !== undefined ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx
					label={
						line.clock === LineClockModeEnumSchema.enum["clock-lifetime"]
							? "Clock - Expiry"
							: "Clock - Interval"
					}
				/>
			</span>
		) : null}
	</>
);
