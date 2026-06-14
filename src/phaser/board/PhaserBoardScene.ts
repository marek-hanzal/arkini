import Phaser from "phaser";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { cellKey } from "~/board/util/cell";
import { resolveDropIntent } from "~/merge/resolveDropIntent";
import { clamp01 } from "~/phaser/common/clamp01";
import { colors } from "~/phaser/common/colors";
import { PhaserItemActor } from "~/phaser/common/PhaserItemActor";
import { loadItemTextures } from "~/phaser/common/itemTextureKey";
import { tweenPromise } from "~/phaser/common/tweenPromise";
import type { BoardView, BoardViewItem, ItemCatalogView, ProducerDropResult } from "~/play/logic/playTypes";
import type { ItemId } from "~/manifest/manifestId";

export namespace PhaserBoardScene {
	export interface Handlers {
		move(item: BoardViewItem, x: number, y: number): Promise<void>;
		swap(source: BoardViewItem, target: BoardViewItem): Promise<void>;
		merge(source: BoardViewItem, target: BoardViewItem): Promise<void>;
		activate(item: BoardViewItem, activation: "single" | "exhaust"): Promise<ProducerDropResult>;
		openDetail(item: BoardViewItem): void;
	}

	export interface Props {
		board: BoardView;
		items: ItemCatalogView;
		handlers: Handlers;
	}

	export interface CellRect {
		x: number;
		y: number;
		width: number;
		height: number;
		centerX: number;
		centerY: number;
	}
}

interface BoardActorState {
	actor: PhaserItemActor;
	item: BoardViewItem;
}

interface DragState {
	actor: PhaserItemActor;
	item: BoardViewItem;
	origin: Phaser.Math.Vector2;
	originCell: string;
	dragging: boolean;
	longPress?: Phaser.Time.TimerEvent;
	pointerDownAt: number;
}

export class PhaserBoardScene extends Phaser.Scene {
	private props?: PhaserBoardScene.Props;
	private actors = new Map<string, BoardActorState>();
	private cells = new Map<string, Phaser.GameObjects.Graphics>();
	private effects = new Map<string, { errorUntil?: number; mergeUntil?: number; imprintUntil?: number }>();
	private hoverCell?: string;
	private ready = false;
	private cellWidth = 1;
	private cellHeight = 1;
	private dragging?: DragState;
	private busy = false;
	private tapState?: { boardItemId: string; longFired: boolean; timer: Phaser.Time.TimerEvent };

	constructor() {
		super("arkini-board");
	}

	setProps(props: PhaserBoardScene.Props) {
		this.props = props;
		if (!this.ready) return;
		this.ensureTextures(props.items);
		this.applySnapshot();
	}

	resize(width: number, height: number) {
		this.cellWidth = width / boardColumns;
		this.cellHeight = height / boardRows;
		if (!this.ready) return;
		this.drawGrid();
		this.layoutActors(false);
	}

	preload() {
		if (this.props) loadItemTextures(this, this.props.items);
	}

	create() {
		this.ready = true;
		this.cameras.main.setBackgroundColor("rgba(2,6,23,0)");
		this.installInput();
		this.drawGrid();
		this.applySnapshot();
	}

	override update(time: number) {
		this.drawGrid(time);
		this.updateProgress(time);
	}

	private ensureTextures(items: ItemCatalogView) {
		if (this.load.isLoading()) return;
		const queued = loadItemTextures(this, items);
		if (queued) {
			this.load.once(Phaser.Loader.Events.COMPLETE, () => this.applySnapshot());
			this.load.start();
		}
	}

	private installInput() {
		this.input.on("dragstart", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
			if (this.busy) return;
			const actor = this.actorByContainer(gameObject);
			if (!actor) return;
			this.cancelTapState();
			this.dragging = {
				actor: actor.actor,
				item: actor.item,
				origin: new Phaser.Math.Vector2(actor.actor.container.x, actor.actor.container.y),
				originCell: cellKey(actor.item.x, actor.item.y),
				dragging: true,
				pointerDownAt: Date.now(),
			};
			this.dragging.actor.setRaised(true);
		});

		this.input.on("drag", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
			if (!this.dragging || this.dragging.actor.container !== gameObject) return;
			this.dragging.actor.container.setPosition(dragX, dragY);
			this.setHoverCell(this.cellAt(dragX, dragY));
		});

		this.input.on("dragend", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
			if (!this.dragging || this.dragging.actor.container !== gameObject) return;
			void this.finishDrag();
		});
	}

	private applySnapshot() {
		if (!this.ready || !this.props) return;
		const nextIds = new Set(this.props.board.items.map((item) => item.id));

		for (const [id, state] of this.actors) {
			if (!nextIds.has(id)) {
				this.fadeDestroy(state.actor);
				this.actors.delete(id);
			}
		}

		for (const boardItem of this.props.board.items) {
			const item = this.props.items[boardItem.itemId];
			if (!item) continue;
			const size = this.actorSize();
			const existing = this.actors.get(boardItem.id);
			if (existing) {
				existing.item = boardItem;
				existing.actor.update({
					item,
					size,
					activation: boardItem.activation,
				});
				if (this.dragging?.item.id !== boardItem.id) {
					const rect = this.cellRect(boardItem.x, boardItem.y);
					this.tweenActorTo(existing.actor, rect.centerX, rect.centerY, 180);
				}
				continue;
			}

			const actor = new PhaserItemActor({
				scene: this,
				item,
				size,
				activation: boardItem.activation,
			});
			actor.container.setData("boardItemId", boardItem.id);
			const rect = this.cellRect(boardItem.x, boardItem.y);
			actor.container.setPosition(rect.centerX, rect.centerY);
			actor.container.setAlpha(0);
			actor.container.setScale(0.78);
			this.installActorGestures(actor, boardItem.id);
			this.actors.set(boardItem.id, {
				actor,
				item: boardItem,
			});
			this.tweens.add({
				targets: actor.container,
				alpha: 1,
				scale: 1,
				duration: 220,
				ease: "Back.easeOut",
			});
		}
	}

	private layoutActors(animate: boolean) {
		if (!this.props) return;
		for (const state of this.actors.values()) {
			const item = this.props.items[state.item.itemId];
			if (item) {
				state.actor.update({
					item,
					size: this.actorSize(),
					activation: state.item.activation,
				});
			}
			const rect = this.cellRect(state.item.x, state.item.y);
			if (animate) this.tweenActorTo(state.actor, rect.centerX, rect.centerY, 160);
			else state.actor.container.setPosition(rect.centerX, rect.centerY);
		}
	}

	private drawGrid(time = this.time.now) {
		if (!this.props) return;
		for (let y = 0; y < boardRows; y++) {
			for (let x = 0; x < boardColumns; x++) {
				const key = cellKey(x, y);
				let cell = this.cells.get(key);
				if (!cell) {
					cell = this.add.graphics();
					cell.setDepth(0);
					this.cells.set(key, cell);
				}
				this.drawCell(cell, x, y, key, time);
			}
		}
	}

	private drawCell(cell: Phaser.GameObjects.Graphics, x: number, y: number, key: string, time: number) {
		const rect = this.cellRect(x, y);
		const effect = this.effects.get(key);
		const now = Date.now();
		const isHover = this.hoverCell === key;
		const boardItem = this.props?.board.byCellKey[key];
		const intent = this.mergeIntentForCell(boardItem);
		const canMerge = intent !== "none" && this.dragging?.item.id !== boardItem?.id;
		const ready = this.isReady(boardItem);
		const pulse = ready ? 0.5 + Math.sin(time / 190) * 0.22 : 0;

		cell.clear();
		cell.fillStyle((x + y) % 2 === 0 ? colors.cellBase : colors.cellAlt, 0.58);
		cell.fillRoundedRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2, Math.min(rect.width, rect.height) * 0.08);
		cell.lineStyle(1, colors.cellStroke, 0.55);
		cell.strokeRoundedRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2, Math.min(rect.width, rect.height) * 0.08);

		if (ready) {
			cell.fillStyle(colors.ready, 0.05 + pulse * 0.1);
			cell.fillRoundedRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10, Math.min(rect.width, rect.height) * 0.08);
			cell.lineStyle(1.5, colors.ready, 0.25 + pulse * 0.22);
			cell.strokeRoundedRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10, Math.min(rect.width, rect.height) * 0.08);
		}

		if (canMerge) {
			cell.fillStyle(intent === "merge" ? colors.merge : colors.imprint, isHover ? 0.34 : 0.18);
			cell.fillRoundedRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, Math.min(rect.width, rect.height) * 0.08);
			cell.lineStyle(isHover ? 3 : 2, intent === "merge" ? colors.mergeStrong : colors.imprint, isHover ? 0.95 : 0.65);
			cell.strokeRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
		} else if (isHover) {
			cell.fillStyle(colors.cellHover, 0.42);
			cell.fillRoundedRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4, Math.min(rect.width, rect.height) * 0.08);
		}

		if (effect?.errorUntil && effect.errorUntil > now) {
			cell.fillStyle(colors.error, 0.36);
			cell.fillRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
			cell.lineStyle(3, colors.error, 0.82);
			cell.strokeRoundedRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6, Math.min(rect.width, rect.height) * 0.08);
		}

		if (effect?.mergeUntil && effect.mergeUntil > now) {
			const life = clamp01((effect.mergeUntil - now) / 520);
			cell.lineStyle(4, colors.mergeStrong, life);
			cell.strokeRoundedRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8, Math.min(rect.width, rect.height) * 0.08);
		}

		if (effect?.imprintUntil && effect.imprintUntil > now) {
			const life = clamp01((effect.imprintUntil - now) / 600);
			cell.lineStyle(4, colors.imprint, life);
			cell.strokeRoundedRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10, Math.min(rect.width, rect.height) * 0.08);
		}
	}

	private updateProgress(_time: number) {
		if (!this.props) return;
		for (const item of this.props.board.items) {
			const cell = this.cells.get(cellKey(item.x, item.y));
			if (!cell) continue;
			const rect = this.cellRect(item.x, item.y);
			const craftProgress = item.craft?.progress;
			const cooldownProgress = this.cooldownProgress(item);
			if (craftProgress && craftProgress > 0) {
				cell.fillStyle(colors.craft, 0.13);
				cell.fillRoundedRect(rect.x + 4, rect.y + rect.height * (1 - clamp01(craftProgress)), rect.width - 8, rect.height * clamp01(craftProgress) - 4, Math.min(rect.width, rect.height) * 0.06);
			}
			if (cooldownProgress !== undefined) {
				cell.fillStyle(0x020617, 0.72);
				cell.fillRoundedRect(rect.x + 5, rect.y + rect.height - 8, rect.width - 10, 4, 2);
				cell.fillStyle(colors.cooldown, 0.9);
				cell.fillRoundedRect(rect.x + 5, rect.y + rect.height - 8, (rect.width - 10) * clamp01(cooldownProgress), 4, 2);
			}
		}
	}

	private installActorGestures(actor: PhaserItemActor, boardItemId: string) {
		actor.container.on("pointerdown", () => {
			if (this.busy) return;
			this.cancelTapState();
			const state = {
				boardItemId,
				longFired: false,
				timer: this.time.delayedCall(480, () => {
					const current = this.actors.get(boardItemId)?.item;
					if (!current || this.dragging || this.busy) return;
					state.longFired = true;
					this.props?.handlers.openDetail(current);
				}),
			};
			this.tapState = state;
		});

		actor.container.on("pointerup", () => {
			const state = this.tapState;
			this.cancelTapState();
			if (!state || state.boardItemId !== boardItemId || state.longFired || this.dragging || this.busy) return;
			const current = this.actors.get(boardItemId)?.item;
			if (!current) return;
			if (!current.activation) {
				this.props?.handlers.openDetail(current);
				return;
			}
			void this.activate(current, current.activation.kind === "stash" ? "exhaust" : "single");
		});
	}

	private cancelTapState(remove = true) {
		if (!this.tapState) return;
		if (remove) this.tapState.timer.remove(false);
		this.tapState = undefined;
	}

	private async finishDrag() {
		if (!this.dragging || !this.props) return;
		const drag = this.dragging;
		this.dragging = undefined;
		this.setHoverCell(undefined);

		const targetCell = this.cellAt(drag.actor.container.x, drag.actor.container.y);
		if (!targetCell) {
			await this.rejectDrag(drag);
			return;
		}

		const [x, y] = targetCell.split(":").map(Number);
		const targetItem = this.props.board.byCellKey[targetCell];
		if (targetItem?.id === drag.item.id) {
			await this.returnActor(drag);
			return;
		}

		this.busy = true;
		try {
			if (!targetItem) {
				const rect = this.cellRect(x, y);
				await this.tweenActorTo(drag.actor, rect.centerX, rect.centerY, 170);
				await this.props.handlers.move(drag.item, x, y);
				drag.actor.setRaised(false);
				return;
			}

			const intent = resolveDropIntent({
				sourceItemId: drag.item.itemId as ItemId,
				targetItem,
			});

			if (intent.type === "reject") {
				this.flashCell(targetCell);
				await this.rejectDrag(drag);
				return;
			}

			if (intent.type === "swap") {
				const targetActor = this.actors.get(targetItem.id)?.actor;
				const targetRect = this.cellRect(targetItem.x, targetItem.y);
				const originRect = this.cellRect(drag.item.x, drag.item.y);
				await Promise.all([
					this.tweenActorTo(drag.actor, targetRect.centerX, targetRect.centerY, 190),
					targetActor ? this.tweenActorTo(targetActor, originRect.centerX, originRect.centerY, 190) : Promise.resolve(),
				]);
				await this.props.handlers.swap(drag.item, targetItem);
				drag.actor.setRaised(false);
				return;
			}

			const targetActor = this.actors.get(targetItem.id)?.actor;
			const targetRect = this.cellRect(targetItem.x, targetItem.y);
			const directed = intent.type === "merge" && intent.directed;
			const pulseKind = directed || intent.type !== "merge" ? "imprint" : "merge";
			await this.tweenActorTo(drag.actor, targetRect.centerX, targetRect.centerY, directed ? 160 : 210);
			await tweenPromise({
				scene: this,
				targets: drag.actor.container,
				duration: 140,
				props: {
					alpha: 0,
					scale: 0.35,
				},
			});
			await this.props.handlers.merge(drag.item, targetItem);
			this.pulseCell(targetCell, pulseKind);
			targetActor?.pulse(pulseKind === "imprint" ? colors.imprint : colors.mergeStrong);
		} catch (error) {
			this.flashCell(targetCell);
			drag.actor.flashError();
			await this.returnActor(drag);
			if (import.meta.env.DEV) console.debug("Board action failed", error);
		} finally {
			drag.actor.setRaised(false);
			this.busy = false;
		}
	}

	private async rejectDrag(drag: DragState) {
		drag.actor.flashError();
		this.flashCell(this.cellAt(drag.actor.container.x, drag.actor.container.y));
		await this.returnActor(drag);
	}

	private async returnActor(drag: DragState) {
		await this.tweenActorTo(drag.actor, drag.origin.x, drag.origin.y, 180);
		drag.actor.container.setAlpha(1);
		drag.actor.container.setScale(1);
		drag.actor.setRaised(false);
	}

	private async activate(item: BoardViewItem, mode: "single" | "exhaust") {
		if (!this.props || this.busy) return;
		const actor = this.actors.get(item.id)?.actor;
		this.busy = true;
		try {
			actor?.pulse(colors.ready);
			const result = await this.props.handlers.activate(item, mode);
			await this.playProducerDrop(result);
		} catch (error) {
			this.flashCell(cellKey(item.x, item.y));
			actor?.flashError();
			if (import.meta.env.DEV) console.debug("Producer action failed", error);
		} finally {
			this.busy = false;
		}
	}

	private async playProducerDrop(result: ProducerDropResult) {
		const source = this.actors.get(result.producerBoardItemId)?.item;
		if (!source) return;
		const sourceRect = this.cellRect(source.x, source.y);
		const animations: Promise<void>[] = [];
		for (const placement of result.placements) {
			if (placement.kind !== "board" || !placement.boardItemId) continue;
			const actor = this.actors.get(placement.boardItemId)?.actor;
			if (!actor || placement.x === undefined || placement.y === undefined) continue;
			const targetRect = this.cellRect(placement.x, placement.y);
			actor.container.setPosition(sourceRect.centerX, sourceRect.centerY);
			actor.container.setAlpha(0);
			actor.container.setScale(0.45);
			actor.setRaised(true);
			animations.push(
				tweenPromise({
					scene: this,
					targets: actor.container,
					duration: 360,
					ease: "Back.easeOut",
					props: {
						x: targetRect.centerX,
						y: targetRect.centerY,
						alpha: 1,
						scale: 1,
					},
				}).then(() => actor.setRaised(false)),
			);
		}
		await Promise.all(animations);
	}

	private actorByContainer(gameObject: Phaser.GameObjects.GameObject): BoardActorState | undefined {
		for (const state of this.actors.values()) {
			if (state.actor.container === gameObject) return state;
		}
		return undefined;
	}

	private cellAt(x: number, y: number): string | undefined {
		const column = Math.floor(x / this.cellWidth);
		const row = Math.floor(y / this.cellHeight);
		if (column < 0 || row < 0 || column >= boardColumns || row >= boardRows) return undefined;
		return cellKey(column, row);
	}

	private cellRect(x: number, y: number): PhaserBoardScene.CellRect {
		const width = this.cellWidth;
		const height = this.cellHeight;
		return {
			x: x * width,
			y: y * height,
			width,
			height,
			centerX: x * width + width / 2,
			centerY: y * height + height / 2,
		};
	}

	private actorSize() {
		return Math.min(this.cellWidth, this.cellHeight) * 0.86;
	}

	private tweenActorTo(actor: PhaserItemActor, x: number, y: number, duration: number) {
		return tweenPromise({
			scene: this,
			targets: actor.container,
			duration,
			props: {
				x,
				y,
				alpha: 1,
				scale: 1,
			},
		});
	}

	private fadeDestroy(actor: PhaserItemActor) {
		this.tweens.add({
			targets: actor.container,
			alpha: 0,
			scale: 0.55,
			y: actor.container.y + this.cellHeight * 0.18,
			duration: 180,
			ease: "Cubic.easeIn",
			onComplete: () => actor.destroy(),
		});
	}

	private setHoverCell(cell: string | undefined) {
		this.hoverCell = cell;
	}

	private flashCell(cell: string | undefined) {
		if (!cell) return;
		this.effects.set(cell, {
			...(this.effects.get(cell) ?? {}),
			errorUntil: Date.now() + 520,
		});
	}

	private pulseCell(cell: string, kind: "merge" | "imprint") {
		this.effects.set(cell, {
			...(this.effects.get(cell) ?? {}),
			mergeUntil: kind === "merge" ? Date.now() + 520 : undefined,
			imprintUntil: kind === "imprint" ? Date.now() + 600 : undefined,
		});
	}

	private mergeIntentForCell(boardItem: BoardViewItem | undefined): "none" | "merge" | "imprint" | "swap" {
		if (!this.dragging || !boardItem || boardItem.id === this.dragging.item.id) return "none";
		const intent = resolveDropIntent({
			sourceItemId: this.dragging.item.itemId as ItemId,
			targetItem: boardItem,
		});
		if (intent.type === "reject") return "none";
		if (intent.type === "swap") return "swap";
		if (intent.type !== "merge") return "imprint";
		return intent.directed ? "imprint" : "merge";
	}

	private isReady(boardItem: BoardViewItem | undefined) {
		if (!boardItem?.activation) return false;
		const activation = boardItem.activation;
		if (activation.remainingCharges !== undefined && activation.remainingCharges <= 0) return false;
		if ((activation.cooldownUntilMs ?? 0) > Date.now()) return false;
		return activation.inputs.every((input) => input.stored >= input.quantity);
	}

	private cooldownProgress(boardItem: BoardViewItem) {
		const activation = boardItem.activation;
		if (!activation?.cooldownUntilMs || !activation.cooldownMs) return undefined;
		const remaining = activation.cooldownUntilMs - Date.now();
		if (remaining <= 0) return undefined;
		return 1 - remaining / activation.cooldownMs;
	}
}
