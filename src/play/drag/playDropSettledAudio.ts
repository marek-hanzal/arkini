import type { GameAudioPlayer } from "~/audio/GameAudioPlayer";

export const playDropSettledAudio = ({
	audio,
	kind,
}: {
	audio: Pick<GameAudioPlayer, "play">;
	kind: "accept" | "ignore" | "reject";
}) => {
	if (kind === "accept") {
		audio.play("audio.tile.drop.accept");
		return;
	}

	if (kind === "reject") audio.play("audio.tile.drop.reject");
};
