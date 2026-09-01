import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readGameDiagnosticItemReferenceFn {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly runtimeItemId: string | null;
		readonly itemId?: string;
		readonly runtimes: readonly RuntimeSchema.Type[];
	}
}

/** Resolves a runtime or authored item identity to its immutable config UID. */
export const readGameDiagnosticItemReferenceFn = ({
	config,
	runtimeItemId,
	itemId,
	runtimes,
}: readGameDiagnosticItemReferenceFn.Props): GameDiagnosticItemReferenceSchema.Type => {
	const runtimeItem =
		runtimeItemId === null
			? undefined
			: runtimes
					.flatMap((runtime) => runtime.items)
					.find((candidate) => candidate.id === runtimeItemId);
	const definitionId = runtimeItem?.item.id ?? itemId;
	const definition =
		definitionId === undefined ? undefined : (config.items[definitionId] ?? runtimeItem?.item);
	return {
		runtimeItemId,
		definition:
			definition === undefined
				? null
				: {
						itemId: definition.id,
						itemUid: definition.uid,
						title: definition.title,
					},
	};
};
