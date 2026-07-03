import type { GameAudioEvent } from "~/audio/GameAudioEvent";

export type GameAudioSoundId = GameAudioEvent.Id;

export interface GameAudioSound {
	cooldownMs: number;
	volume: number;
}

const quiet = 0.26;
const normal = 0.38;
const strong = 0.52;

export const gameAudioSoundCatalog = {
	"audio.ui.sheet.open": {
		cooldownMs: 90,
		volume: quiet,
	},
	"audio.ui.sheet.close": {
		cooldownMs: 90,
		volume: quiet,
	},
	"audio.ui.error": {
		cooldownMs: 140,
		volume: strong,
	},
	"audio.ui.reject.board": {
		cooldownMs: 120,
		volume: normal,
	},
	"audio.ui.reject.inventory": {
		cooldownMs: 120,
		volume: normal,
	},
	"audio.tile.drag.start": {
		cooldownMs: 45,
		volume: 0.18,
	},
	"audio.tile.drop.accept": {
		cooldownMs: 40,
		volume: 0.2,
	},
	"audio.tile.drop.reject": {
		cooldownMs: 90,
		volume: normal,
	},
	"audio.tile.long_press": {
		cooldownMs: 90,
		volume: quiet,
	},
	"audio.inventory.place": {
		cooldownMs: 40,
		volume: normal,
	},
	"audio.board.stash": {
		cooldownMs: 70,
		volume: quiet,
	},
	"audio.inventory.swap": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.board.move": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.board.swap": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.merge.success": {
		cooldownMs: 70,
		volume: strong,
	},
	"audio.merge.output": {
		cooldownMs: 70,
		volume: quiet,
	},
	"audio.producer.input.store": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.producer.input.withdraw": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.producer.start": {
		cooldownMs: 90,
		volume: normal,
	},
	"audio.producer.complete": {
		cooldownMs: 90,
		volume: strong,
	},
	"audio.producer.blocked": {
		cooldownMs: 220,
		volume: strong,
	},
	"audio.producer.failed": {
		cooldownMs: 220,
		volume: strong,
	},
	"audio.producer.depleted": {
		cooldownMs: 120,
		volume: normal,
	},
	"audio.line.default_changed": {
		cooldownMs: 90,
		volume: quiet,
	},
	"audio.stash.open.start": {
		cooldownMs: 90,
		volume: normal,
	},
	"audio.stash.release": {
		cooldownMs: 120,
		volume: normal,
	},
	"audio.craft.input.store": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.craft.input.withdraw": {
		cooldownMs: 45,
		volume: quiet,
	},
	"audio.craft.start": {
		cooldownMs: 90,
		volume: normal,
	},
	"audio.craft.complete": {
		cooldownMs: 120,
		volume: strong,
	},
	"audio.craft.result.replace": {
		cooldownMs: 120,
		volume: normal,
	},
	"audio.craft.blocked": {
		cooldownMs: 220,
		volume: strong,
	},
	"audio.craft.failed": {
		cooldownMs: 220,
		volume: strong,
	},
	"audio.tile.remove": {
		cooldownMs: 70,
		volume: normal,
	},
	"audio.tile.remove.output": {
		cooldownMs: 60,
		volume: quiet,
	},
	"audio.effect.activated": {
		cooldownMs: 120,
		volume: quiet,
	},
	"audio.effect.expired": {
		cooldownMs: 120,
		volume: 0.18,
	},
	"audio.item.spawn.blocked": {
		cooldownMs: 220,
		volume: strong,
	},
	"audio.item.spawn.failed": {
		cooldownMs: 220,
		volume: strong,
	},
	"audio.debug.spawn.board": {
		cooldownMs: 30,
		volume: quiet,
	},
	"audio.debug.spawn.inventory": {
		cooldownMs: 30,
		volume: quiet,
	},
	"audio.cheat.speed.enable": {
		cooldownMs: 120,
		volume: strong,
	},
	"audio.cheat.speed.disable": {
		cooldownMs: 120,
		volume: strong,
	},
} satisfies Record<GameAudioSoundId, GameAudioSound>;
