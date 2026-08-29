import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateSelectorReferenceFn } from "./validateSelectorReferenceFn";

export namespace validateWhenReferenceFn {
	export interface Props {
		config: GameConfigSchema.Type;
		when: WhenSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

/** Validates canonical references used by one rule condition query. */
export const validateWhenReferenceFn = ({
	config,
	when,
	path,
	source,
}: validateWhenReferenceFn.Props) =>
	validateSelectorReferenceFn({
		config,
		selector: when.query.selector,
		path: [
			...path,
			"query",
			"selector",
		],
		source,
	});
