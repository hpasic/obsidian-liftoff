// Only the Obsidian surface used by the tests. Importing this in node is safe;
// DOM helpers are installed explicitly by jsdom suites.
type ElementOptions = string | {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
	type?: string;
	placeholder?: string;
};

function createEl(tag: string, options: ElementOptions = {}): HTMLElement {
	const el = document.createElement(tag);
	const opts = typeof options === "string" ? { cls: options } : options;
	if (opts.cls) el.className = Array.isArray(opts.cls) ? opts.cls.join(" ") : opts.cls;
	if (opts.text !== undefined) el.textContent = opts.text;
	for (const [key, value] of Object.entries(opts.attr ?? {})) el.setAttribute(key, value);
	if (opts.type) el.setAttribute("type", opts.type);
	if (opts.placeholder) el.setAttribute("placeholder", opts.placeholder);
	return el;
}

export function installObsidianDom(): void {
	Object.assign(HTMLElement.prototype, {
		createEl(this: HTMLElement, tag: string, options?: ElementOptions) {
			const el = createEl(tag, options);
			this.appendChild(el);
			return el;
		},
		createDiv(this: HTMLElement, options?: ElementOptions) { return this.createEl("div", options); },
		createSpan(this: HTMLElement, options?: ElementOptions) { return this.createEl("span", options); },
		empty(this: HTMLElement) { this.replaceChildren(); },
		addClass(this: HTMLElement, ...classes: string[]) { this.classList.add(...classes); },
		removeClass(this: HTMLElement, ...classes: string[]) { this.classList.remove(...classes); },
		toggleClass(this: HTMLElement, cls: string, value: boolean) { this.classList.toggle(cls, value); },
		setText(this: HTMLElement, text: string) { this.textContent = text; },
		setAttr(this: HTMLElement, name: string, value: string) { this.setAttribute(name, value); },
		setCssProps(this: HTMLElement, props: Record<string, string>) {
			for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
		},
	});
	Object.assign(globalThis, {
		createEl,
		createDiv: (options?: ElementOptions) => createEl("div", options),
		createSpan: (options?: ElementOptions) => createEl("span", options),
	});
	Object.assign(window, { activeWindow: window });
}

export class Plugin {}
export class TFile { path = ""; basename = ""; extension = "md"; name = ""; }
export class TFolder { path = ""; children: unknown[] = []; }
export function normalizePath(path: string): string { return path; }
export class PluginSettingTab {}

export class ItemView {
	app: unknown;
	containerEl = createEl("div");
	private cleanups: (() => void)[] = [];

	constructor(leaf: { app: unknown }) {
		this.app = leaf.app;
		this.containerEl.createDiv({ cls: "view-header" });
		this.containerEl.createDiv({ cls: "view-content" });
	}

	register(callback: () => void): void { this.cleanups.push(callback); }

	// Component unload runs registered disposers; onClose is a separate view hook.
	unload(): void {
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}
}

export class Component {
	loaded = false;
	load(): void { this.loaded = true; }
	unload(): void { this.loaded = false; }
}

export const MarkdownRenderer = {
	// Stand-in renderer: keeps the markdown source visible for assertions
	render(_app: unknown, markdown: string, el: HTMLElement): Promise<void> {
		el.createDiv({ cls: "markdown-rendered", text: markdown });
		return Promise.resolve();
	},
};

export class Modal {
	modalEl = createEl("div", { cls: "modal" });
	contentEl = this.modalEl.createDiv({ cls: "modal-content" });

	constructor(public app: unknown) {}
	open(): void { document.body.appendChild(this.modalEl); this.onOpen(); }
	close(): void { this.onClose(); this.modalEl.remove(); }
	onOpen(): void {}
	onClose(): void {}
}

export class Notice {
	constructor(public message: string) {}
}

export function setIcon(el: HTMLElement, icon: string): void {
	el.replaceChildren();
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("data-icon", icon);
	el.appendChild(svg);
}

export class Setting {
	settingEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;

	constructor(container: HTMLElement) {
		this.settingEl = container.createDiv({ cls: "setting-item" });
		this.nameEl = this.settingEl.createDiv({ cls: "setting-item-name" });
		this.descEl = this.settingEl.createDiv({ cls: "setting-item-description" });
	}
	setName(name: string): this { this.nameEl.setText(name); return this; }
	setDesc(desc: string): this { this.descEl.setText(desc); return this; }
}

class MenuItem {
	button = createEl("button");
	setTitle(title: string): this { this.button.setText(title); return this; }
	setIcon(icon: string): this { this.button.setAttr("data-icon", icon); return this; }
	onClick(callback: () => void): this {
		this.button.addEventListener("click", callback);
		return this;
	}
}

export class Menu {
	private menuEl = createEl("div", { cls: "menu" });
	addItem(callback: (item: MenuItem) => void): this {
		const item = new MenuItem();
		callback(item);
		item.button.addEventListener("click", () => this.menuEl.remove());
		this.menuEl.appendChild(item.button);
		return this;
	}
	showAtMouseEvent(): void { document.body.appendChild(this.menuEl); }
}
