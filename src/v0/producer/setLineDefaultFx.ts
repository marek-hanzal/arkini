import { Effect } from "effect";
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
import { removeProducerLineStateFromSaveFx } from "~/producer/removeProducerLineStateFromSaveFx";
import { writeProducerLineStateToSaveFx } from "~/producer/writeProducerLineStateToSaveFx";
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

const readLineSetDefaultReadinessFx = Effect.fn("setLineDefaultFx.readLineSetDefaultReadinessFx")(
	function* ({ action, config, nowMs, save }: setLineDefaultFx.Props) {
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
	lineId,
}: {
	checked: LineSetDefaultReadiness;
	lineId: string;
}) {
	const line = readLineDefinition({
		lineId,
		producerDefinition: checked.producerDefinition,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${lineId}".`),
		);
	}

	return readLineKind({
		line,
	});
});

const readPreviousDefaultLineIdFx = Effect.fn("setLineDefaultFx.readPreviousDefaultLineIdFx")(
	function* ({
		checked,
		kind,
		props,
	}: {
		checked: LineSetDefaultReadiness;
		kind: LineDefaultKind;
		props: setLineDefaultFx.Props;
	}) {
		const lineIds = readLineIds({
			producerDefinition: checked.producerDefinition,
		});
		return yield* match(kind)
			.with("effect", () =>
				Effect.succeed(
					readDefaultEffectLineId({
						itemInstanceId: props.action.itemInstanceId,
						lineIds,
						save: props.save,
					}),
				),
			)
			.with("product", () =>
				Effect.succeed(
					readDefaultLineId({
						itemInstanceId: props.action.itemInstanceId,
						lineIds,
						save: props.save,
					}),
				),
			)
			.exhaustive();
	},
);

const readLineDefaultSelectionFx = Effect.fn("setLineDefaultFx.readLineDefaultSelectionFx")(
	function* ({
		checked,
		props,
	}: {
		checked: LineSetDefaultReadiness;
		props: setLineDefaultFx.Props;
	}) {
		const kind = yield* readSelectedLineKindFx({
			checked,
			lineId: props.action.lineId,
		});
		const previousLineId = yield* readPreviousDefaultLineIdFx({
			checked,
			kind,
			props,
		});
		return {
			kind,
			nextLineId: previousLineId === props.action.lineId ? undefined : props.action.lineId,
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
	function* ({
		itemInstanceId,
		nextSave,
		selection,
	}: {
		itemInstanceId: string;
		nextSave: GameSave;
		selection: LineDefaultSelection;
	}) {
		const nextLineState = readNextLineState({
			kind: selection.kind,
			nextLineId: selection.nextLineId,
			previousState: nextSave.lines[itemInstanceId],
		});

		if (nextLineState) {
			yield* writeProducerLineStateToSaveFx({
				itemInstanceId,
				save: nextSave,
				state: nextLineState,
			});
		} else {
			yield* removeProducerLineStateFromSaveFx({
				itemInstanceId,
				save: nextSave,
			});
		}
	},
);

const finishLineDefaultSelectionFx = Effect.fn("setLineDefaultFx.finishLineDefaultSelectionFx")(
	function* ({
		props,
		selection,
	}: {
		props: setLineDefaultFx.Props;
		selection: LineDefaultSelection;
	}) {
		const nextSave = yield* cloneGameSaveFx({
			save: props.save,
		});
		yield* writeLineDefaultSelectionFx({
			itemInstanceId: props.action.itemInstanceId,
			nextSave,
			selection,
		});
		nextSave.updatedAtMs = props.nowMs;

		return yield* createGameEngineResultFx({
			config: props.config,
			events: [
				{
					atMs: props.nowMs,
					itemInstanceId: props.action.itemInstanceId,
					nextLineId: selection.nextLineId,
					previousLineId: selection.previousLineId,
					type: "line.default_changed" as const,
				},
			],
			nowMs: props.nowMs,
			save: nextSave,
		});
	},
);

const setLineDefaultProgramFx = Effect.fn("setLineDefaultFx.setLineDefaultProgramFx")(function* (
	props: setLineDefaultFx.Props,
) {
	const checked = yield* readLineSetDefaultReadinessFx(props);
	return yield* finishLineDefaultSelectionFx({
		props,
		selection: yield* readLineDefaultSelectionFx({
			checked,
			props,
		}),
	});
});

export const setLineDefaultFx = Effect.fn("setLineDefaultFx")(function* (
	props: setLineDefaultFx.Props,
) {
	return yield* setLineDefaultProgramFx(props);
});
