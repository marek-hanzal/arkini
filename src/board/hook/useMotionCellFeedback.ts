import { useEffect, useRef, type RefObject } from "react";
import { playCellError } from "~/animation/playCellError";
import { playCellImprint } from "~/animation/playCellImprint";
import { playCellSuccess } from "~/animation/playCellSuccess";

export namespace useMotionCellFeedback {
	export interface Props {
		invalid: boolean;
		success: boolean;
		imprint: boolean;
	}
}

export function useMotionCellFeedback<TElement extends HTMLElement>(
	ref: RefObject<TElement | null>,
	{ invalid, success, imprint }: useMotionCellFeedback.Props,
) {
	const wasInvalidRef = useRef(false);
	const wasSuccessRef = useRef(success);
	const wasImprintRef = useRef(imprint);
	const didMountSuccessRef = useRef(false);
	const didMountImprintRef = useRef(false);

	useEffect(() => {
		const element = ref.current;
		if (element && invalid && !wasInvalidRef.current) playCellError(element);
		wasInvalidRef.current = invalid;
	}, [
		invalid,
		ref,
	]);

	useEffect(() => {
		const element = ref.current;

		if (!didMountSuccessRef.current) {
			didMountSuccessRef.current = true;
			wasSuccessRef.current = success;
			return;
		}

		if (element && success && !wasSuccessRef.current) playCellSuccess(element);
		wasSuccessRef.current = success;
	}, [
		success,
		ref,
	]);

	useEffect(() => {
		const element = ref.current;

		if (!didMountImprintRef.current) {
			didMountImprintRef.current = true;
			wasImprintRef.current = imprint;
			return;
		}

		if (element && imprint && !wasImprintRef.current) playCellImprint(element);
		wasImprintRef.current = imprint;
	}, [
		imprint,
		ref,
	]);
}
