import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { TypeSchema as InputTypeSchema } from "~/production-input/schema/TypeSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";

import { releaseJobReservationsFx } from "./releaseJobReservationsFx";

export namespace reconcileJobAfterMaterialExpiryFx {
	export interface Props {
		readonly jobId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
		readonly status: "aborted" | "continued";
	}
}

const hasRequiredJobMaterialsFn = ({
	job,
	line,
	runtime,
}: {
	readonly job: JobSchema.Type;
	readonly line: LineSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) =>
	line.input.every((input, inputIndex) => {
		if (input.type !== InputTypeSchema.enum.Materials) return true;
		const quantity = runtime.items.reduce((total, item) => {
			if (
				(item.location.scope !== LocationScopeEnumSchema.enum.Job &&
					item.location.scope !== LocationScopeEnumSchema.enum.Reserved) ||
				item.location.jobId !== job.id ||
				item.location.inputIndex !== inputIndex
			) {
				return total;
			}
			return total + item.quantity;
		}, 0);
		return quantity >= input.quantity.min;
	});

/** Keeps a viable job running or atomically discards its consumed work and returns reservations. */
export const reconcileJobAfterMaterialExpiryFx = Effect.fn("reconcileJobAfterMaterialExpiryFx")(
	function* ({ jobId, runtime }: reconcileJobAfterMaterialExpiryFx.Props) {
		const job = runtime.jobs.find((candidate) => candidate.id === jobId);
		if (job === undefined) return yield* Effect.die(new Error(`Job ${jobId} is missing.`));
		const { line, owner } = yield* readBoardItemLineFx({
			lineId: job.lineId,
			ownerItemId: job.ownerItemId,
			runtime,
		});
		if (
			hasRequiredJobMaterialsFn({
				job,
				line,
				runtime,
			})
		) {
			return {
				events: [],
				runtime,
				status: "continued",
			} satisfies reconcileJobAfterMaterialExpiryFx.Result;
		}

		const consumedItems = runtime.items.filter(
			(item): item is JobRuntimeItemSchema.Type =>
				item.location.scope === LocationScopeEnumSchema.enum.Job &&
				item.location.jobId === job.id,
		);
		const reservations = runtime.items.filter(
			(item): item is ReservedRuntimeItemSchema.Type =>
				item.location.scope === LocationScopeEnumSchema.enum.Reserved &&
				item.location.jobId === job.id,
		);
		let draft = {
			...runtime,
			jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
		} satisfies RuntimeSchema.Type;
		for (const consumedItem of consumedItems) {
			draft = yield* removeRuntimeItemIdentityFx({
				item: consumedItem,
				runtime: draft,
			});
		}
		const released = yield* releaseJobReservationsFx({
			origin: owner.location,
			originItemId: owner.id,
			reservations,
			runtime: draft,
		});
		return {
			events: released.events,
			runtime: released.runtime,
			status: "aborted",
		} satisfies reconcileJobAfterMaterialExpiryFx.Result;
	},
);
