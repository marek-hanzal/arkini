import { toDiagnosticValueResultFn } from "~/application-diagnostics/fn/toDiagnosticValueFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readGameDiagnosticItemReferenceFn } from "~/game-incident/fn/readGameDiagnosticItemReferenceFn";
import type { GameDiagnosticHistoryEntrySchema } from "~/game-incident/schema/GameDiagnosticHistorySchema";
import type { GameDiagnosticItemReferenceSchema } from "~/game-incident/schema/GameDiagnosticReferenceSchema";
import type { GameTransition } from "~/game-session/type/GameSession";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const diagnosticCollectionLimit = 100;

const readRuntimeItemIdsFn = (value: unknown, ids: Set<string>, seen = new WeakSet<object>()) => {
	if (value === null || typeof value !== "object" || seen.has(value)) return;
	seen.add(value);
	if (value instanceof Error && "cause" in value) {
		readRuntimeItemIdsFn(value.cause, ids, seen);
	}
	if (value instanceof AggregateError) {
		for (const error of value.errors) readRuntimeItemIdsFn(error, ids, seen);
	}
	if (Array.isArray(value)) {
		for (const entry of value) readRuntimeItemIdsFn(entry, ids, seen);
		return;
	}
	for (const [key, entry] of Object.entries(value)) {
		if (
			typeof entry === "string" &&
			(key === "itemId" || key.endsWith("ItemId")) &&
			!key.toLowerCase().includes("canonical")
		) {
			ids.add(entry);
		}
		readRuntimeItemIdsFn(entry, ids, seen);
	}
};

const readCanonicalItemIdsFn = (value: unknown, ids: Set<string>, seen = new WeakSet<object>()) => {
	if (value === null || typeof value !== "object" || seen.has(value)) return;
	seen.add(value);
	if (value instanceof Error && "cause" in value) {
		readCanonicalItemIdsFn(value.cause, ids, seen);
	}
	if (value instanceof AggregateError) {
		for (const error of value.errors) readCanonicalItemIdsFn(error, ids, seen);
	}
	if (Array.isArray(value)) {
		for (const entry of value) readCanonicalItemIdsFn(entry, ids, seen);
		return;
	}
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === "string" && key.toLowerCase().includes("canonicalitemid")) {
			ids.add(entry);
		}
		readCanonicalItemIdsFn(entry, ids, seen);
	}
};

export const readGameDiagnosticRelatedItemsResultFn = ({
	config,
	transition,
	value,
}: {
	readonly config: GameConfigSchema.Type;
	readonly transition: GameTransition;
	readonly value: unknown;
}): {
	readonly items: GameDiagnosticItemReferenceSchema.Type[];
	readonly truncated: boolean;
} => {
	const runtimes = [
		transition.runtime,
		...(transition.previousRuntime === null
			? []
			: [
					transition.previousRuntime,
				]),
	];
	const runtimeIds = new Set<string>();
	const canonicalIds = new Set<string>();
	readRuntimeItemIdsFn(value, runtimeIds);
	readCanonicalItemIdsFn(value, canonicalIds);
	const references = Array.from(runtimeIds, (runtimeItemId) =>
		readGameDiagnosticItemReferenceFn({
			config,
			runtimeItemId,
			runtimes,
		}),
	);
	const referencedDefinitions = new Set(
		references.flatMap(({ definition }) =>
			definition === null
				? []
				: [
						definition.itemId,
					],
		),
	);
	for (const itemId of canonicalIds) {
		if (referencedDefinitions.has(itemId)) continue;
		references.push(
			readGameDiagnosticItemReferenceFn({
				config,
				itemId,
				runtimeItemId: null,
				runtimes,
			}),
		);
	}
	return {
		items: references.slice(0, diagnosticCollectionLimit),
		truncated: references.length > diagnosticCollectionLimit,
	};
};

const omitResolvedItemIdsFn = (
	details: Readonly<Record<string, unknown>>,
	hasRelatedItems: boolean,
) =>
	hasRelatedItems
		? Object.fromEntries(
				Object.entries(details).filter(
					([key]) => key !== "itemId" && !key.endsWith("ItemId"),
				),
			)
		: details;

const readJobsFn = (
	config: GameConfigSchema.Type,
	runtime: RuntimeSchema.Type,
	runtimes: readonly RuntimeSchema.Type[],
) =>
	runtime.jobs.map((job) => ({
		jobId: job.id,
		lineId: job.lineId,
		owner: readGameDiagnosticItemReferenceFn({
			config,
			runtimeItemId: job.ownerItemId,
			runtimes,
		}),
	}));

const readQueueFn = (
	config: GameConfigSchema.Type,
	runtime: RuntimeSchema.Type,
	runtimes: readonly RuntimeSchema.Type[],
) =>
	runtime.jobQueue.map((request) => ({
		requestId: request.id,
		lineId: request.lineId,
		owner: readGameDiagnosticItemReferenceFn({
			config,
			runtimeItemId: request.ownerItemId,
			runtimes,
		}),
	}));

export const readGameDiagnosticTransitionSignatureFn = (transition: GameTransition) =>
	JSON.stringify({
		deliveries: transition.runtime.items.flatMap((item) =>
			item.location.scope === "delivery"
				? [
						{
							itemId: item.id,
							generation: item.location.generation,
							phase: item.location.phase,
							origin: item.location.origin,
							endpoint:
								item.location.phase === "outbound"
									? item.location.target
									: item.location.returnFrom,
						},
					]
				: [],
		),
		jobs: transition.runtime.jobs.map(({ id, lineId, ownerItemId }) => ({
			id,
			lineId,
			ownerItemId,
		})),
		queue: transition.runtime.jobQueue,
		defaultLines: Object.entries(transition.runtime.defaultLineByOwnerItemId).sort(
			([left], [right]) => left.localeCompare(right),
		),
	});

export const readGameDiagnosticHistoryEntryFn = ({
	config,
	elapsedSincePreviousMs,
	observedAt,
	transition,
}: {
	readonly config: GameConfigSchema.Type;
	readonly elapsedSincePreviousMs: number | null;
	readonly observedAt: string;
	readonly transition: GameTransition;
}): GameDiagnosticHistoryEntrySchema.Type => {
	const previous = transition.previousRuntime;
	const runtimes = [
		transition.runtime,
		...(previous === null
			? []
			: [
					previous,
				]),
	];
	const jobs = readJobsFn(config, transition.runtime, runtimes);
	const previousJobs = previous === null ? [] : readJobsFn(config, previous, runtimes);
	const queue = readQueueFn(config, transition.runtime, runtimes);
	const previousQueue = previous === null ? [] : readQueueFn(config, previous, runtimes);
	const previousDefaultLines = previous?.defaultLineByOwnerItemId ?? {};
	const defaultLineOwnerIds = new Set([
		...Object.keys(previousDefaultLines),
		...Object.keys(transition.runtime.defaultLineByOwnerItemId),
	]);
	const jobsAdded =
		previous === null
			? []
			: jobs.filter(
					(job) => !previousJobs.some((candidate) => candidate.jobId === job.jobId),
				);
	const jobsRemoved = previousJobs.filter(
		(job) => !jobs.some((candidate) => candidate.jobId === job.jobId),
	);
	const queueAdded =
		previous === null
			? []
			: queue.filter(
					(request) =>
						!previousQueue.some(
							(candidate) => candidate.requestId === request.requestId,
						),
				);
	const queueRemoved = previousQueue.filter(
		(request) => !queue.some((candidate) => candidate.requestId === request.requestId),
	);
	const defaultLinesChanged = (previous === null ? [] : Array.from(defaultLineOwnerIds))
		.sort((left, right) => left.localeCompare(right))
		.flatMap((runtimeItemId) => {
			const previousLineId = previousDefaultLines[runtimeItemId] ?? null;
			const lineId = transition.runtime.defaultLineByOwnerItemId[runtimeItemId] ?? null;
			return previousLineId === lineId
				? []
				: [
						{
							owner: readGameDiagnosticItemReferenceFn({
								config,
								runtimeItemId,
								runtimes,
							}),
							previousLineId,
							lineId,
						},
					];
		});
	const deliveryResults = transition.runtime.items.flatMap((item) => {
		const location = item.location;
		if (location.scope !== "delivery") return [];
		const origin = toDiagnosticValueResultFn(location.origin);
		const endpoint = toDiagnosticValueResultFn(
			location.phase === "outbound" ? location.target : location.returnFrom,
		);
		return [
			{
				delivery: {
					item: readGameDiagnosticItemReferenceFn({
						config,
						runtimeItemId: item.id,
						runtimes,
					}),
					quantity: item.quantity,
					generation: location.generation,
					phase: location.phase,
					origin: origin.value,
					endpoint: endpoint.value,
				},
				truncated: origin.truncated || endpoint.truncated,
			},
		];
	});
	const eventResults = transition.events.slice(0, diagnosticCollectionLimit).map((event) => {
		const { type, ...rawDetails } = event;
		const related = readGameDiagnosticRelatedItemsResultFn({
			config,
			transition,
			value: event,
		});
		const details = toDiagnosticValueResultFn(
			omitResolvedItemIdsFn(rawDetails, related.items.length > 0),
		);
		return {
			event: {
				type,
				details: details.value,
				relatedItems: related.items,
			},
			truncated: details.truncated || related.truncated,
		};
	});
	const truncated =
		[
			transition.events,
			jobsAdded,
			jobsRemoved,
			queueAdded,
			queueRemoved,
			defaultLinesChanged,
			deliveryResults,
		].some((collection) => collection.length > diagnosticCollectionLimit) ||
		eventResults.some((result) => result.truncated) ||
		deliveryResults.some((result) => result.truncated);
	return {
		sequence: transition.sequence,
		observedAt,
		elapsedSincePreviousMs,
		initial: previous === null,
		events: eventResults.map((result) => result.event),
		itemCount: transition.runtime.items.length,
		jobCount: transition.runtime.jobs.length,
		queueCount: transition.runtime.jobQueue.length,
		jobsAdded: jobsAdded.slice(0, diagnosticCollectionLimit),
		jobsRemoved: jobsRemoved.slice(0, diagnosticCollectionLimit),
		queueAdded: queueAdded.slice(0, diagnosticCollectionLimit),
		queueRemoved: queueRemoved.slice(0, diagnosticCollectionLimit),
		defaultLinesChanged: defaultLinesChanged.slice(0, diagnosticCollectionLimit),
		deliveries: deliveryResults
			.slice(0, diagnosticCollectionLimit)
			.map((result) => result.delivery),
		truncated,
	};
};
