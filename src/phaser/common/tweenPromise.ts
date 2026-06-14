import Phaser from "phaser";
export namespace tweenPromise {
	export interface Props {
		scene: Phaser.Scene;
		targets: Phaser.Types.Tweens.TweenBuilderConfig["targets"];
		duration?: number;
		ease?: string;
		props: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets" | "duration" | "ease" | "onComplete">;
	}
}

export const tweenPromise = ({
	scene,
	targets,
	duration = 180,
	ease = "Cubic.easeOut",
	props,
}: tweenPromise.Props) =>
	new Promise<void>((resolve) => {
		scene.tweens.add({
			...props,
			targets,
			duration,
			ease,
			onComplete: () => resolve(),
		});
	});
