export const formatDetailLinePercent = (value: number) => {
	const percent = value * 100;
	const rounded = Math.round(percent * 10) / 10;
	return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};
