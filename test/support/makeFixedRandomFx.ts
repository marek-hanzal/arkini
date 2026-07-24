import { Effect, Random } from "effect";

/**
 * Creates the one reusable deterministic Random service used by tests.
 *
 * Values model Effect 4's `nextDoubleUnsafe` contract and must stay in [0, 1).
 */
export const makeFixedRandomFx = Effect.fn("makeFixedRandomFx")(function* (
	values: readonly [
		number,
		...number[],
	],
) {
	let index = 0;
	const nextDoubleUnsafe = () => {
		const value = values[index];
		index = (index + 1) % values.length;
		if (value === undefined || !Number.isFinite(value) || value < 0 || value >= 1) {
			throw new RangeError(
				`Fixed random value must be finite and in [0, 1), received ${value}.`,
			);
		}
		return value;
	};

	return {
		nextDoubleUnsafe,
		nextIntUnsafe: () => Math.round(nextDoubleUnsafe()),
	} satisfies typeof Random.Random.Service;
});
