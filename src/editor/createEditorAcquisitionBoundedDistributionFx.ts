import { Effect } from "effect";

export interface EditorAcquisitionDistributionOutcome {
	readonly probability: number;
	readonly quantities: ReadonlyMap<string, number>;
}

export type EditorAcquisitionDistribution = ReadonlyArray<EditorAcquisitionDistributionOutcome>;

export interface EditorAcquisitionBoundedDistribution {
	readonly maximumOutcomeStates: number;
	readonly normalizeFx: (
		distribution: EditorAcquisitionDistribution,
	) => Effect.Effect<EditorAcquisitionDistribution>;
	readonly constantFx: (
		id?: string,
		quantity?: number,
	) => Effect.Effect<EditorAcquisitionDistribution>;
	readonly mixFx: (
		branches: ReadonlyArray<{
			readonly distribution: EditorAcquisitionDistribution;
			readonly probability: number;
		}>,
	) => Effect.Effect<EditorAcquisitionDistribution | undefined>;
	readonly convolveFx: (
		left: EditorAcquisitionDistribution | undefined,
		right: EditorAcquisitionDistribution | undefined,
	) => Effect.Effect<EditorAcquisitionDistribution | undefined>;
	readonly repeatFx: (
		distribution: EditorAcquisitionDistribution | undefined,
		count: number,
	) => Effect.Effect<EditorAcquisitionDistribution | undefined>;
	readonly optionalFx: (
		distribution: EditorAcquisitionDistribution | undefined,
		probability: number,
	) => Effect.Effect<EditorAcquisitionDistribution | undefined>;
	readonly marginalFx: (
		distribution: EditorAcquisitionDistribution,
		readQuantity: (quantities: ReadonlyMap<string, number>) => number,
	) => Effect.Effect<
		ReadonlyArray<{
			readonly probability: number;
			readonly quantity: number;
		}>
	>;
}

/** Creates the editor-only bounded outcome-distribution capability. */
export const createEditorAcquisitionBoundedDistributionFx = Effect.fn(
	"createEditorAcquisitionBoundedDistributionFx",
)(() =>
	Effect.sync(() => {
		const maximumOutcomeStates = 4_096;
		const stateKey = (quantities: ReadonlyMap<string, number>) =>
			[
				...quantities,
			]
				.filter(([, quantity]) => quantity > 0)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([id, quantity]) => `${id}:${quantity}`)
				.join("\u0000");
		const normalize = (
			distribution: EditorAcquisitionDistribution,
		): EditorAcquisitionDistribution => {
			const merged = new Map<
				string,
				{
					probability: number;
					quantities: ReadonlyMap<string, number>;
				}
			>();
			for (const outcome of distribution) {
				const key = stateKey(outcome.quantities);
				const current = merged.get(key);
				merged.set(key, {
					probability: (current?.probability ?? 0) + outcome.probability,
					quantities: current?.quantities ?? outcome.quantities,
				});
			}
			const outcomes = [
				...merged.values(),
			].filter(({ probability }) => probability > 1e-12);
			const total = outcomes.reduce((sum, { probability }) => sum + probability, 0);
			return outcomes
				.map((outcome) => ({
					...outcome,
					probability: outcome.probability / total,
				}))
				.sort((left, right) =>
					stateKey(left.quantities).localeCompare(stateKey(right.quantities)),
				);
		};
		const constant = (id?: string, quantity = 0): EditorAcquisitionDistribution => [
			{
				probability: 1,
				quantities:
					id === undefined || quantity <= 0
						? new Map()
						: new Map([
								[
									id,
									quantity,
								],
							]),
			},
		];
		const mix = (
			branches: ReadonlyArray<{
				readonly distribution: EditorAcquisitionDistribution;
				readonly probability: number;
			}>,
		) => {
			if (
				branches.reduce((sum, branch) => sum + branch.distribution.length, 0) >
				maximumOutcomeStates
			)
				return undefined;
			return normalize(
				branches.flatMap((branch) =>
					branch.distribution.map((outcome) => ({
						...outcome,
						probability: outcome.probability * branch.probability,
					})),
				),
			);
		};
		const convolve = (
			left: EditorAcquisitionDistribution | undefined,
			right: EditorAcquisitionDistribution | undefined,
		) => {
			if (
				left === undefined ||
				right === undefined ||
				left.length * right.length > maximumOutcomeStates
			)
				return undefined;
			return normalize(
				left.flatMap((leftOutcome) =>
					right.map((rightOutcome) => {
						const quantities = new Map(leftOutcome.quantities);
						for (const [id, quantity] of rightOutcome.quantities)
							quantities.set(id, (quantities.get(id) ?? 0) + quantity);
						return {
							probability: leftOutcome.probability * rightOutcome.probability,
							quantities,
						};
					}),
				),
			);
		};
		const repeat = (distribution: EditorAcquisitionDistribution | undefined, count: number) => {
			if (distribution === undefined || count > maximumOutcomeStates) return undefined;
			let result: EditorAcquisitionDistribution | undefined = constant();
			for (let index = 0; index < count && result !== undefined; index += 1)
				result = convolve(result, distribution);
			return result;
		};
		const optional = (
			distribution: EditorAcquisitionDistribution | undefined,
			probability: number,
		) =>
			distribution === undefined
				? undefined
				: mix([
						{
							distribution,
							probability,
						},
						{
							distribution: constant(),
							probability: 1 - probability,
						},
					]);
		const marginal = (
			distribution: EditorAcquisitionDistribution,
			readQuantity: (quantities: ReadonlyMap<string, number>) => number,
		) => {
			const probabilities = new Map<number, number>();
			for (const outcome of distribution) {
				const quantity = readQuantity(outcome.quantities);
				probabilities.set(
					quantity,
					(probabilities.get(quantity) ?? 0) + outcome.probability,
				);
			}
			return [
				...probabilities,
			]
				.filter(([, probability]) => probability > 1e-12)
				.sort(([left], [right]) => left - right)
				.map(([quantity, probability]) => ({
					probability,
					quantity,
				}));
		};
		return {
			maximumOutcomeStates,
			normalizeFx: (distribution) => Effect.sync(() => normalize(distribution)),
			constantFx: (id, quantity) => Effect.sync(() => constant(id, quantity)),
			mixFx: (branches) => Effect.sync(() => mix(branches)),
			convolveFx: (left, right) => Effect.sync(() => convolve(left, right)),
			repeatFx: (distribution, count) => Effect.sync(() => repeat(distribution, count)),
			optionalFx: (distribution, probability) =>
				Effect.sync(() => optional(distribution, probability)),
			marginalFx: (distribution, readQuantity) =>
				Effect.sync(() => marginal(distribution, readQuantity)),
		} satisfies EditorAcquisitionBoundedDistribution;
	}),
);
