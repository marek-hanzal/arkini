import { gsap } from "gsap";

const sheetDurationSeconds = 0.28;

export namespace animateBottomSheet {
	export interface Props {
		panel: HTMLElement;
		backdrop: HTMLElement;
		open: boolean;
	}
}

export const animateBottomSheet = ({ panel, backdrop, open }: animateBottomSheet.Props) => {
	gsap.killTweensOf([
		panel,
		backdrop,
	]);

	if (open) {
		gsap.set(
			[
				panel,
				backdrop,
			],
			{
				pointerEvents: "auto",
			},
		);
		gsap.timeline({
			defaults: {
				duration: sheetDurationSeconds,
				ease: "power3.out",
			},
		})
			.to(
				backdrop,
				{
					opacity: 1,
				},
				0,
			)
			.fromTo(
				panel,
				{
					opacity: 0,
					yPercent: 100,
					y: 16,
				},
				{
					opacity: 1,
					yPercent: 0,
					y: 0,
				},
				0,
			);
		return;
	}

	gsap.timeline({
		defaults: {
			duration: sheetDurationSeconds,
			ease: "power3.inOut",
		},
		onComplete: () =>
			gsap.set(
				[
					panel,
					backdrop,
				],
				{
					pointerEvents: "none",
				},
			),
	})
		.to(
			backdrop,
			{
				opacity: 0,
			},
			0,
		)
		.to(
			panel,
			{
				opacity: 0,
				yPercent: 100,
				y: 16,
			},
			0,
		);
};
