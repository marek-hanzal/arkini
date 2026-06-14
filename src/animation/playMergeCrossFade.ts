import type { gsap } from "gsap";

const mergeCrossFadeSeconds = 0.16;

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
				duration: mergeCrossFadeSeconds,
				ease: "none",
			},
			0,
		)
		.to(
			to,
			{
				opacity: 1,
				duration: mergeCrossFadeSeconds,
				ease: "none",
			},
			0,
		);
};
