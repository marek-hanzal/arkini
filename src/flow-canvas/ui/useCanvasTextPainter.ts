import { useMemo } from "react";

interface CanvasTextPainter {
	readonly drawLinesFn: (
		context: CanvasRenderingContext2D,
		lines: ReadonlyArray<string>,
		x: number,
		y: number,
		lineHeight: number,
	) => void;
	readonly fitTextFn: (
		context: CanvasRenderingContext2D,
		value: string,
		maxWidth: number,
	) => string;
	readonly wrapIdentifierFn: (
		context: CanvasRenderingContext2D,
		value: string,
		maxWidth: number,
		maxLines: number,
	) => ReadonlyArray<string>;
	readonly wrapTextFn: (
		context: CanvasRenderingContext2D,
		value: string,
		maxWidth: number,
		maxLines: number,
	) => ReadonlyArray<string>;
}

/** Owns the stable text measurement and drawing callbacks for one Flow Canvas renderer. */
export const useCanvasTextPainter = (): CanvasTextPainter =>
	useMemo(() => {
		const painter: CanvasTextPainter = {
			drawLinesFn: (context, lines, x, y, lineHeight) => {
				for (const [index, line] of lines.entries())
					context.fillText(line, x, y + index * lineHeight);
			},
			fitTextFn: (context, value, maxWidth) => {
				if (context.measureText(value).width <= maxWidth) return value;
				let lower = 0;
				let upper = value.length;
				while (lower < upper) {
					const middle = Math.ceil((lower + upper) / 2);
					if (context.measureText(`${value.slice(0, middle)}…`).width <= maxWidth)
						lower = middle;
					else upper = middle - 1;
				}
				return lower === 0 ? "" : `${value.slice(0, lower)}…`;
			},
			wrapIdentifierFn: (context, value, maxWidth, maxLines) => {
				const lines: string[] = [];
				let remaining = value.trim();
				while (remaining.length > 0 && lines.length < maxLines) {
					if (context.measureText(remaining).width <= maxWidth) {
						lines.push(remaining);
						break;
					}

					let lower = 0;
					let upper = remaining.length;
					while (lower < upper) {
						const middle = Math.ceil((lower + upper) / 2);
						if (context.measureText(remaining.slice(0, middle)).width <= maxWidth)
							lower = middle;
						else upper = middle - 1;
					}
					const end = Math.max(1, lower);
					if (lines.length === maxLines - 1) {
						lines.push(painter.fitTextFn(context, remaining, maxWidth));
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
			},
			wrapTextFn: (context, value, maxWidth, maxLines) => {
				const words = value.trim().split(/\s+/).filter(Boolean);
				if (words.length === 0) return [];
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
						lines.push(painter.fitTextFn(context, word, maxWidth));
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
							lines[maxLines - 1] = painter.fitTextFn(
								context,
								`${lines[maxLines - 1]} ${remainder}`,
								maxWidth,
							);
						return lines;
					}
				}
				if (current.length > 0 && lines.length < maxLines) lines.push(current);
				return lines;
			},
		};
		return painter;
	}, []);
