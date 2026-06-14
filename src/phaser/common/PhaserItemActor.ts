import Phaser from "phaser";
import { colors } from "~/phaser/common/colors";
import { itemOverlayTextureKey, itemTextureKey } from "~/phaser/common/itemTextureKey";
import type { BoardViewItem, InventorySlot, ViewItem } from "~/play/logic/playTypes";

export namespace PhaserItemActor {
	export interface Props {
		scene: Phaser.Scene;
		item: ViewItem;
		size: number;
		quantity?: number;
		activation?: BoardViewItem["activation"];
		interactive?: boolean;
	}

	export interface UpdateProps {
		item: ViewItem;
		size: number;
		quantity?: number;
		activation?: BoardViewItem["activation"];
	}
}

export class PhaserItemActor {
	readonly container: Phaser.GameObjects.Container;
	private readonly scene: Phaser.Scene;
	private readonly background: Phaser.GameObjects.Graphics;
	private readonly image: Phaser.GameObjects.Image;
	private overlay?: Phaser.GameObjects.Image;
	private label?: Phaser.GameObjects.Text;
	private quantity?: Phaser.GameObjects.Text;
	private glow: Phaser.GameObjects.Graphics;
	private item: ViewItem;
	private size: number;

	constructor({ scene, item, size, quantity, activation, interactive = true }: PhaserItemActor.Props) {
		this.scene = scene;
		this.item = item;
		this.size = size;
		this.container = scene.add.container(0, 0);
		this.background = scene.add.graphics();
		this.glow = scene.add.graphics();
		this.image = scene.add.image(0, 0, itemTextureKey(item.id));
		this.image.setOrigin(0.5);
		this.container.add([
			this.glow,
			this.background,
			this.image,
		]);
		this.update({
			item,
			size,
			quantity,
			activation,
		});
		if (interactive) this.enableInput();
	}

	update({ item, size, quantity, activation }: PhaserItemActor.UpdateProps) {
		this.item = item;
		this.size = size;
		this.container.setSize(size, size);
		if (this.container.input) {
			this.container.input.hitArea = new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size);
		}
		this.image.setTexture(itemTextureKey(item.id));
		this.background.clear();
		this.background.fillStyle(colors.shadow, 0.28);
		this.background.fillRoundedRect(-size * 0.44, -size * 0.4, size * 0.88, size * 0.86, size * 0.14);
		this.background.lineStyle(Math.max(1, size * 0.018), colors.cellStroke, 0.46);
		this.background.strokeRoundedRect(-size * 0.44, -size * 0.4, size * 0.88, size * 0.86, size * 0.14);

		const assetSize = size * 0.72;
		if (item.assetRender === "blueprint" && item.assetOverlaySrc) {
			this.image.setDisplaySize(size * 0.48, size * 0.48);
			this.image.setPosition(-size * 0.13, -size * 0.1);
			if (!this.overlay) {
				this.overlay = this.scene.add.image(0, 0, itemOverlayTextureKey(item.id));
				this.container.add(this.overlay);
			}
			this.overlay.setTexture(itemOverlayTextureKey(item.id));
			this.overlay.setPosition(size * 0.14, size * 0.13);
			this.overlay.setDisplaySize(size * 0.54, size * 0.54);
			this.overlay.setVisible(true);
		} else {
			this.image.setDisplaySize(assetSize, assetSize);
			this.image.setPosition(0, -size * 0.03);
			this.overlay?.setVisible(false);
		}

		this.renderBadges(quantity);
		this.renderGlow(activation);
	}

	setRaised(raised: boolean) {
		this.container.setDepth(raised ? 2000 : 100);
		this.container.setScale(raised ? 1.08 : 1);
	}

	pulse(tint = colors.mergeStrong) {
		this.background.lineStyle(Math.max(2, this.size * 0.035), tint, 0.95);
		this.background.strokeRoundedRect(-this.size * 0.46, -this.size * 0.42, this.size * 0.92, this.size * 0.9, this.size * 0.15);
		this.scene.tweens.add({
			targets: this.container,
			scale: {
				from: 1.05,
				to: 1,
			},
			duration: 220,
			ease: "Back.easeOut",
		});
	}

	flashError() {
		this.scene.tweens.add({
			targets: this.container,
			x: this.container.x + 5,
			duration: 55,
			yoyo: true,
			repeat: 3,
			ease: "Sine.easeInOut",
		});
	}

	destroy() {
		this.container.destroy(true);
	}

	private enableInput() {
		const hitArea = new Phaser.Geom.Rectangle(-this.size / 2, -this.size / 2, this.size, this.size);
		this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
		this.scene.input.setDraggable(this.container);
	}

	private renderBadges(quantity: number | undefined) {
		const showQuantity = quantity !== undefined && quantity > 1;
		if (showQuantity) {
			if (!this.quantity) {
				this.quantity = this.scene.add.text(0, 0, "", {
					fontFamily: "system-ui, sans-serif",
					fontSize: `${Math.max(10, this.size * 0.17)}px`,
					fontStyle: "800",
					color: "#f8fafc",
					backgroundColor: "rgba(2,6,23,0.82)",
					padding: {
						x: 4,
						y: 1,
					},
				});
				this.quantity.setOrigin(1, 1);
				this.container.add(this.quantity);
			}
			this.quantity.setText(String(quantity));
			this.quantity.setFontSize(Math.max(10, this.size * 0.17));
			this.quantity.setOrigin(this.item.label ? 0 : 1, 1);
			this.quantity.setPosition(this.item.label ? -this.size * 0.39 : this.size * 0.39, this.size * 0.39);
			this.quantity.setVisible(true);
		} else {
			this.quantity?.setVisible(false);
		}

		if (this.item.label) {
			if (!this.label) {
				this.label = this.scene.add.text(0, 0, "", {
					fontFamily: "system-ui, sans-serif",
					fontSize: `${Math.max(10, this.size * 0.16)}px`,
					fontStyle: "900",
					color: "#fde68a",
					backgroundColor: "rgba(2,6,23,0.86)",
					padding: {
						x: 4,
						y: 1,
					},
				});
				this.label.setOrigin(1, 1);
				this.container.add(this.label);
			}
			this.label.setText(this.item.label);
			this.label.setFontSize(Math.max(10, this.size * 0.16));
			this.label.setPosition(this.size * 0.39, this.size * 0.39);
			this.label.setVisible(true);
		} else {
			this.label?.setVisible(false);
		}
	}

	private renderGlow(activation: BoardViewItem["activation"] | InventorySlot["stack"] | undefined) {
		this.glow.clear();
		if (!activation || !("cooldownUntilMs" in activation)) return;
		const waiting = (activation.cooldownUntilMs ?? 0) > Date.now();
		if (waiting) return;

		this.glow.fillStyle(colors.ready, 0.16);
		this.glow.fillCircle(0, 0, this.size * 0.48);
		this.glow.lineStyle(Math.max(1, this.size * 0.018), colors.ready, 0.35);
		this.glow.strokeCircle(0, 0, this.size * 0.44);
	}
}
