import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionLineSetDefaultSchema } from "~/action/GameActionLineSetDefaultSchema";
import { readLineDefinition, readLineIds } from "~/config/GameItemCapabilities";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { checkLineSetDefaultReadinessFx } from "~/producer/checkLineSetDefaultReadinessFx";
import { readDefaultEffectLineId } from "~/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/producer/readDefaultLineId";
import { readLineKind } from "~/producer/readLineKind";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace setLineDefaultFx {
	export interface Props {
		action: GameActionLineSetDefaultSchema.Type;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

type LineSetDefaultReadiness = Effect.Effect.Success<
	ReturnType<typeof checkLineSetDefaultReadinessFx>
>;

type LineDefaultKind = "effect" | "product";

type LineDefaultSelection = {
	kind: LineDefaultKind;
	nextLineId: string | undefined;
	previousLineId: string | undefined;
};

class LineDefaultSelectionScopeFx extends Context.Tag("LineDefaultSelectionScopeFx")<
	LineDefaultSelectionScopeFx,
	setLineDefaultFx.Props
>() {
	//
}

const readLineSetDefaultReadinessFx = Effect.fn("setLineDefaultFx.readLineSetDefaultReadinessFx")(
	function* () {
		const { action, config, nowMs, save } = yield* LineDefaultSelectionScopeFx;
		return yield* checkLineSetDefaultReadinessFx({
			action,
			config,
			nowMs,
			save,
		});
	},
);

const readSelectedLineKindFx = Effect.fn("setLineDefaultFx.readSelectedLineKindFx")(function* ({
	checked,
}: {
	checked: LineSetDefaultReadiness;
}) {
	const { action } = yield* LineDefaultSelectionScopeFx;
	const line = readLineDefinition({
		lineId: action.lineId,
		producerDefinition: checked.producerDefinition,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${action.lineId}".`),
		);
	}

	return readLineKind({
		line,
	});
});

const readPreviousDefaultLineIdFx = Effect.fn("setLineDefaultFx.readPreviousDefaultLineIdFx")(
	function* ({ checked, kind }: { checked: LineSetDefaultReadiness; kind: LineDefaultKind }) {
		const { action, save } = yield* LineDefaultSelectionScopeFx;
		const lineIds = readLineIds({
			producerDefinition: checked.producerDefinition,
		});
		return yield* match(kind)
			.with("effect", () =>
				Effect.succeed(
					readDefaultEffectLineId({
						itemInstanceId: action.itemInstanceId,
						lineIds,
						save,
					}),
				),
			)
			.with("product", () =>
				Effect.succeed(
					readDefaultLineId({
						itemInstanceId: action.itemInstanceId,
						lineIds,
						save,
					}),
				),
			)
			.exhaustive();
	},
);

const readLineDefaultSelectionFx = Effect.fn("setLineDefaultFx.readLineDefaultSelectionFx")(
	function* ({ checked }: { checked: LineSetDefaultReadiness }) {
		const { action } = yield* LineDefaultSelectionScopeFx;
		const kind = yield* readSelectedLineKindFx({
			checked,
		});
		const previousLineId = yield* readPreviousDefaultLineIdFx({
			checked,
			kind,
		});
		return {
			kind,
			nextLineId: previousLineId === action.lineId ? undefined : action.lineId,
			previousLineId,
		} satisfies LineDefaultSelection;
	},
);

const readNextLineState = ({
	kind,
	nextLineId,
	previousState,
}: {
	kind: LineDefaultKind;
	nextLineId: string | undefined;
	previousState: GameSave["lines"][string] | undefined;
}): GameSave["lines"][string] | undefined => {
	const nextState = {
		...(previousState ?? {}),
		...(kind === "effect"
			? {
					defaultEffectLineId: nextLineId,
				}
			: {
					defaultLineId: nextLineId,
				}),
	};

	if (!nextState.defaultLineId && !nextState.defaultEffectLineId) return undefined;
	return nextState;
};

const writeLineDefaultSelectionFx = Effect.fn("setLineDefaultFx.writeLineDefaultSelectionFx")(
	function* ({ nextSave, selection }: { nextSave: GameSave; selection: LineDefaultSelection }) {
		const { action } = yield* LineDefaultSelectionScopeFx;
		const nextLineState = readNextLineState({
			kind: selection.kind,
			nextLineId: selection.nextLineId,
			previousState: nextSave.lines[action.itemInstanceId],
		});

		if (nextLineState) {
			nextSave.lines[action.itemInstanceId] = nextLineState;
		} else {
			delete nextSave.lines[action.itemInstanceId];
		}
	},
);

const finishLineDefaultSelectionFx = Effect.fn("setLineDefaultFx.finishLineDefaultSelectionFx")(
	function* ({ selection }: { selection: LineDefaultSelection }) {
		const { action, config, nowMs, save } = yield* LineDefaultSelectionScopeFx;
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		yield* writeLineDefaultSelectionFx({
			nextSave,
			selection,
		});
		nextSave.updatedAtMs = nowMs;

		return yield* createGameEngineResultFx({
			config,
			events: [
				{
					atMs: nowMs,
					itemInstanceId: action.itemInstanceId,
					nextLineId: selection.nextLineId,
					previousLineId: selection.previousLineId,
					type: "line.default_changed" as const,
				},
			],
			nowMs,
			save: nextSave,
		});
	},
);

const setLineDefaultProgramFx = Effect.fn("setLineDefaultFx.setLineDefaultProgramFx")(function* () {
	const checked = yield* readLineSetDefaultReadinessFx();
	return yield* finishLineDefaultSelectionFx({
		selection: yield* readLineDefaultSelectionFx({
			checked,
		}),
	});
});

export const setLineDefaultFx = Effect.fn("setLineDefaultFx")(function* (
	props: setLineDefaultFx.Props,
) {
	return yield* setLineDefaultProgramFx().pipe(
		Effect.provideService(LineDefaultSelectionScopeFx, props),
	);
});
