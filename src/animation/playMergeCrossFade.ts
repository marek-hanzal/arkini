import type { gsap } from "gsap";

export namespace playMergeCrossFade {
	export interface Props {
		timeline: gsap.core.Timeline;
		from: HTMLElement | null;
		to: HTMLElement | null;
	}
}

export const playMergeCrossFade = ({ timeline, from, to }: playMergeCrossFade.Props) => {
	if (!from || !to) return;

	timeline
		.to(
			from,
			{
				opacity: 0,
				duration: 0.18,
				ease: "power1.out",
			},
			0.06,
		)
		.to(
			to,
			{
				opacity: 1,
				scale: 1,
				duration: 0.2,
				ease: "power2.out",
			},
			0.06,
		);
};
