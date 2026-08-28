const readFittingPrefixLength = (
	context: CanvasRenderingContext2D,
	value: string,
	maxWidth: number,
	suffix = "",
) => {
	let lower = 0;
	let upper = value.length;
	while (lower < upper) {
		const middle = Math.ceil((lower + upper) / 2);
		if (context.measureText(`${value.slice(0, middle)}${suffix}`).width <= maxWidth)
			lower = middle;
		else upper = middle - 1;
	}
	return lower;
};

const fitText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
	if (context.measureText(value).width <= maxWidth) return value;
	const end = readFittingPrefixLength(context, value, maxWidth, "…");
	return end === 0 ? "" : `${value.slice(0, end)}…`;
};

const wrapText = (
	context: CanvasRenderingContext2D,
	value: string,
	maxWidth: number,
	maxLines: number,
) => {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [] as string[];
	const lines: string[] = [];
	let current = "";
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index]!;
		const candidate = current.length === 0 ? word : `${current} ${word}`;
		if (context.measureText(candidate).width <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current.length > 0) {
			lines.push(current);
			current = word;
		} else {
			lines.push(fitText(context, word, maxWidth));
			current = "";
		}
		if (lines.length === maxLines) {
			const remainder = [
				current,
				...words.slice(index + 1),
			]
				.filter(Boolean)
				.join(" ");
			if (remainder.length > 0)
				lines[maxLines - 1] = fitText(
					context,
					`${lines[maxLines - 1]} ${remainder}`,
					maxWidth,
				);
			return lines;
		}
	}
	if (current.length > 0 && lines.length < maxLines) lines.push(current);
	return lines;
};

const wrapIdentifier = (
	context: CanvasRenderingContext2D,
	value: string,
	maxWidth: number,
	maxLines: number,
) => {
	const lines: string[] = [];
	let remaining = value.trim();
	while (remaining.length > 0 && lines.length < maxLines) {
		if (context.measureText(remaining).width <= maxWidth) {
			lines.push(remaining);
			break;
		}

		const end = Math.max(1, readFittingPrefixLength(context, remaining, maxWidth));
		if (lines.length === maxLines - 1) {
			lines.push(fitText(context, remaining, maxWidth));
			break;
		}

		let breakAt = end;
		for (let index = end - 1; index >= Math.floor(end * 0.55); index -= 1) {
			if (":/-_.".includes(remaining[index]!)) {
				breakAt = index + 1;
				break;
			}
		}
		lines.push(remaining.slice(0, breakAt));
		remaining = remaining.slice(breakAt);
	}
	return lines;
};

const drawTextLines = (
	context: CanvasRenderingContext2D,
	lines: ReadonlyArray<string>,
	x: number,
	y: number,
	lineHeight: number,
) => {
	for (const [index, line] of lines.entries()) context.fillText(line, x, y + index * lineHeight);
};

/** Creates the fitting and wrapping policy used by Canvas flow labels. */
export const createCanvasTextPainterFx = Effect.fn(
	"createCanvasTextPainterFx",
)(() =>
	Effect.succeed({
		drawTextLines,
		fitText,
		wrapIdentifier,
		wrapText,
	} as const),
);
import { Effect } from "effect";
