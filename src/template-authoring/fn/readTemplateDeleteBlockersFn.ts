import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { validateConfigReferencesFn } from "~/game-config-validation/fn/validateConfigReferencesFn";

/** Editor and MCP use the canonical reference traversal, including every outcome owner. */
export const readTemplateDeleteBlockersFn = (config: GameConfigSchema.Type, templateUid: string) =>
	validateConfigReferencesFn({
		config: {
			...config,
			templates: config.templates?.filter((entry) => entry.uid !== templateUid),
		},
		provenance: {
			items: {},
		},
	}).filter(
		(entry) =>
			entry.code === "config:missing-reference" &&
			entry.reference === "template" &&
			entry.referenceId === templateUid,
	);
