export interface GameRandomResult {
	seed: number;
	value: number;
}

const modulus = 0x1_0000_0000;

export const nextGameRandom = (seed: number): GameRandomResult => {
	const nextSeed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;

	return {
		seed: nextSeed,
		value: nextSeed / modulus,
	};
};
