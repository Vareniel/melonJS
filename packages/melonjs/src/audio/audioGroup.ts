import { audio } from "../index";

export class AudioGroup {
	name: string;
	parent: AudioGroup | null;
	children: AudioGroup[];
	volume: number;
	actualVolume: number;
	audioClips: string[];

	constructor(name: string, parent: AudioGroup | null = null) {
		this.name = name;
		this.parent = parent;
		this.children = [];
		this.volume = 1.0;
		this.actualVolume = 1.0;
		this.audioClips = [];

		if (parent) {
			parent.addChild(this);
			this.updateEffectiveVolume();
		}
	}

	addChild(childGroup: AudioGroup): void {
		this.children.push(childGroup);
		childGroup.updateEffectiveVolume();
	}

	addAudioClip(clipName: string): void {
		this.audioClips.push(clipName);
	}

	setVolume(volume: number): void {
		this.volume = volume;
		this.updateEffectiveVolume();
	}

	updateEffectiveVolume(): void {
		if (this.parent) {
			this.actualVolume = this.volume * this.parent.actualVolume;
		} else {
			this.actualVolume = this.volume;
		}

		this.audioClips.forEach((clip: string) => {
			audio.setAudioVolume(clip, this.actualVolume);
		});

		this.children.forEach((child: AudioGroup) => {
			child.updateEffectiveVolume();
		});
	}

	play(clipName: string, loop: boolean = false): void {
		if (this.audioClips.includes(clipName)) {
			audio.play(clipName, loop, null, this.actualVolume);
		} else {
			console.warn(`Clip ${clipName} not found in group ${this.name}`);
		}
	}

	stop(clipName: string): void {
		audio.stop(clipName);
	}

	playAll(): void {
		this.audioClips.forEach((clipName: string) => {
			audio.play(clipName, false, null, this.actualVolume);
		});
		this.children.forEach((child: AudioGroup) => {
			child.playAll();
		});
	}

	stopAll(): void {
		this.audioClips.forEach((clipName: string) => {
			audio.stop(clipName);
		});
		this.children.forEach((child: AudioGroup) => {
			child.stopAll();
		});
	}
}
