export interface ChebyshevPoint {
	x: number;
	y: number;
}

export const readChebyshevDistance = (left: ChebyshevPoint, right: ChebyshevPoint) =>
	Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
