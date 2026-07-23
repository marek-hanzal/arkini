import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { match } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const interactionCompletionFallbackMs = 2_000;

/** Owns position and visual completion predicates, generations, callbacks, and fallbacks. */
export const useTileActorMotionCompletion = ({
	item,
	positionCompletion,
	visualCompletionGeneration,
	complete,
}: {
	readonly item: useTileActors.Item;
	readonly positionCompletion: useTileActorPresentation.PositionCompletion;
	readonly visualCompletionGeneration: number | null;
	readonly complete: (itemId: string, generation: number) => void;
}) => {
	const itemRef = useRef(item);
	const positionCompletionRef = useRef(positionCompletion);
	const visualCompletionGenerationRef = useRef(visualCompletionGeneration);

	useLayoutEffect(() => {
		itemRef.current = item;
		positionCompletionRef.current = positionCompletion;
		visualCompletionGenerationRef.current = visualCompletionGeneration;
	}, [
		item,
		positionCompletion,
		visualCompletionGeneration,
	]);

	const canCompletePosition = useCallback(
		() =>
			match(positionCompletionRef.current)
				.with(
					{
						kind: "none",
					},
					() => false,
				)
				.with(
					{
						kind: "always",
					},
					() => true,
				)
				.with(
					{
						kind: "location",
					},
					({ location }) => isSameTileLocation(itemRef.current.location, location),
				)
				.exhaustive(),
		[],
	);

	const completePosition = useCallback(
		(expectedGeneration?: number) => {
			const current = positionCompletionRef.current;
			if (current.kind === "none") return;
			if (expectedGeneration !== undefined && current.generation !== expectedGeneration)
				return;
			if (!canCompletePosition()) return;
			complete(itemRef.current.id, current.generation);
		},
		[
			canCompletePosition,
			complete,
		],
	);

	const onVisualAnimationComplete = useCallback(() => {
		const generation = visualCompletionGeneration;
		if (generation === null) return;
		if (visualCompletionGenerationRef.current !== generation) return;
		complete(itemRef.current.id, generation);
	}, [
		complete,
		visualCompletionGeneration,
	]);

	useEffect(() => {
		const generation = visualCompletionGeneration;
		if (generation === null) return;
		const fallback = setTimeout(() => {
			if (visualCompletionGenerationRef.current !== generation) return;
			complete(itemRef.current.id, generation);
		}, interactionCompletionFallbackMs);
		return () => clearTimeout(fallback);
	}, [
		complete,
		visualCompletionGeneration,
	]);

	useEffect(() => {
		if (positionCompletion.kind === "none") return;
		const generation = positionCompletion.generation;
		const fallback = setTimeout(() => {
			const current = positionCompletionRef.current;
			if (current.kind === "none" || current.generation !== generation) return;
			complete(itemRef.current.id, generation);
		}, interactionCompletionFallbackMs);
		return () => clearTimeout(fallback);
	}, [
		complete,
		positionCompletion,
	]);

	return {
		completePosition,
		onVisualAnimationComplete,
	};
};
