import type { z } from "zod";
import { GameNearbyDistanceSchema } from "~/config/schema/GameLineEffectSchema";

export type NearbyDistance = z.infer<typeof GameNearbyDistanceSchema>;

export const readNearbyDistanceBucket = (distance: number): NearbyDistance => {
	if (distance <= 1) return "neighbour";
	if (distance <= 2) return "near";
	return "any";
};

export const doesNearbyDistanceMatch = ({
	distance,
	nearbyDistance,
}: {
	distance: number;
	nearbyDistance: NearbyDistance;
}) => {
	if (nearbyDistance === "neighbour") return distance <= 1;
	if (nearbyDistance === "near") return distance <= 2;
	return true;
};
