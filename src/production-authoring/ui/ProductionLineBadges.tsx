import type { LineSchema } from "~/production-line/schema/LineSchema";
import { Tx } from "~/translation/ui/Tx";

/** Shows the Default, Clock and Check ahead markers of an authored line. */
export const ProductionLineBadges = ({ line }: { readonly line: LineSchema.Type }) => (
	<>
		{line.default ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx label="Default" />
			</span>
		) : null}
		{line.clock === true ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx label="Clock" />
			</span>
		) : null}
		{line.ahead === true ? (
			<span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-foreground">
				<Tx label="Check ahead" />
			</span>
		) : null}
	</>
);
