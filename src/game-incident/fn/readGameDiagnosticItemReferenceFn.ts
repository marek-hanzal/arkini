import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readGameDiagnosticItemReferenceFn {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly runtimeItemId: string | null;
		readonly itemUid?: string;
		readonly runtimes: readonly RuntimeSchema.Type[];
	}
}

/** Resolves a runtime or authored item identity to its immutable config UID. */
export const readGameDiagnosticItemReferenceFn = ({
	config,
	runtimeItemId,
	itemUid,
	runtimes,
}: readGameDiagnosticItemReferenceFn.Props): GameDiagnosticItemReferenceSchema.Type => {
	const runtimeItem =
		runtimeItemId === null
			? undefined
			: runtimes
					.flatMap((runtime) => runtime.items)
					.find((candidate) => candidate.id === runtimeItemId);
	const definitionUid = runtimeItem?.item.uid ?? itemUid;
	const definition =
		definitionUid === undefined
			? undefined
			: (config.items[definitionUid] ?? runtimeItem?.item);
	return {
		runtimeItemId,
		definition:
			definition === undefined
				? null
				: {
						itemUid: definition.uid,
						title: definition.title,
					},
	};
};
