import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";
import type { DiagnosticPathSchema } from "../schema/DiagnosticPathSchema";
import { validateSelectorReferenceFx } from "./validateSelectorReferenceFx";

export namespace validateWhenReferenceFx {
	export interface Props {
		config: GameConfigSchema.Type;
		when: WhenSchema.Type;
		path: DiagnosticPathSchema.Type;
		source?: string;
	}
}

/** Validates canonical references used by one rule condition query. */
export const validateWhenReferenceFx = Effect.fn("validateWhenReferenceFx")(function* ({
	config,
	when,
	path,
	source,
}: validateWhenReferenceFx.Props) {
	return yield* validateSelectorReferenceFx({
		config,
		selector: when.query.selector,
		path: [
			...path,
			"query",
			"selector",
		],
		source,
	});
});
