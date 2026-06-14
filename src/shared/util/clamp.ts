export const clamp = (value: number, min: number, max: number) => {
	if (min > max) return min + (max - min) / 2;
	return Math.min(Math.max(value, min), max);
};
