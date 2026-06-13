import { useEffect, useRef } from "react";
import { playActionErrorPulse } from "~/play/util/animation";

export namespace ActionErrorPulse {
	export interface Props {
		pulseKey: number;
	}
}

export function ActionErrorPulse({ pulseKey }: ActionErrorPulse.Props) {
	const ref = useRef<HTMLSpanElement | null>(null);

	useEffect(() => {
		const element = ref.current;
		if (element) playActionErrorPulse(element);
	}, [
		pulseKey,
	]);

	if (pulseKey <= 0) return null;

	return (
		<span
			ref={ref}
			className="pointer-events-none absolute inset-2 z-20 rounded-xl"
		/>
	);
}
