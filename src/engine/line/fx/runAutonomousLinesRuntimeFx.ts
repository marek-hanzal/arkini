import { Effect, Option } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
import { autofillLineInputsRuntimeFx } from "~/engine/input/write/autofillLineInputsFx";
import { requestLineStartRuntimeFx } from "~/engine/job/fx/requestLineStartRuntimeFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace runAutonomousLinesRuntimeFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Advances each idle player-enabled autonomous line by one canonical start-or-deliver decision. */
export const runAutonomousLinesRuntimeFx = Effect.fn("runAutonomousLinesRuntimeFx")(function* ({
	runtime,
}: runAutonomousLinesRuntimeFx.Props) {
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	const selections = [
		...(runtime.autonomousLines ?? []),
	].sort(
		(left, right) =>
			left.ownerItemId.localeCompare(right.ownerItemId) ||
			left.lineId.localeCompare(right.lineId),
	);

	for (const selection of selections) {
		const owner = draft.items.find((candidate) => candidate.id === selection.ownerItemId);
		if (owner?.location.scope !== LocationScopeEnumSchema.enum.Board) continue;
		if (owner.location.space !== draft.currentSpace) continue;
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: selection.lineId,
		});
		if (line?.autonomous !== true) continue;
		const ownerHasWork =
			draft.jobs.some((job) => job.ownerItemId === owner.id) ||
			(draft.jobQueue ?? []).some((request) => request.ownerItemId === owner.id);
		if (ownerHasWork) continue;

		const start = yield* Effect.option(
			requestLineStartRuntimeFx({
				ownerItemId: owner.id,
				lineId: line.id,
				runtime: draft,
				source: JobStartSourceEnumSchema.enum.Autonomous,
			}),
		);
		if (Option.isSome(start)) {
			draft = start.value.runtime;
			events.push(...start.value.events);
			continue;
		}

		const autofill = yield* autofillLineInputsRuntimeFx({
			ownerItemId: owner.id,
			lineId: line.id,
			purpose: {
				kind: "fill-and-try-start",
				ownerItemId: owner.id,
				lineId: line.id,
				source: "autonomous",
			},
			runtime: draft,
		});
		draft = autofill.runtime;
		events.push(...autofill.events);
	}

	return {
		events,
		runtime: draft,
	} satisfies runAutonomousLinesRuntimeFx.Result;
});
