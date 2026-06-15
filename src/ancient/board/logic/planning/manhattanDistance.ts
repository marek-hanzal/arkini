interface Point {
	x: number;
	y: number;
}

export const manhattanDistance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
