import { AudioGroup } from "./audioGroup";

export class AudioMixer {
	masterGroup: AudioGroup;
	constructor() {
		this.masterGroup = new AudioGroup("Master");
	}

	createGroup(name: string, parentName: string = "Master") {
		const parentGroup = this.findGroup(parentName);
		if (parentGroup) {
			return new AudioGroup(name, parentGroup);
		} else {
			console.warn(`Parent group ${parentName} not found`);
			return null;
		}
	}

	findGroup(
		name: string,
		group: AudioGroup = this.masterGroup,
	): AudioGroup | null {
		if (group.name === name) {
			return group;
		}
		for (const child of group.children) {
			const result: AudioGroup | null = this.findGroup(name, child);
			if (result) {
				return result;
			}
		}
		return null;
	}

	setGroupVolume(name: string, volume: number) {
		const group = this.findGroup(name);
		if (group) {
			group.setVolume(volume);
		} else {
			console.warn(`Group ${name} not found`);
		}
	}

	playInGroup(groupName: string, clipName: string, loop: boolean = false) {
		const group = this.findGroup(groupName);
		if (group) {
			group.play(clipName, loop);
		} else {
			console.warn(`Group ${groupName} not found`);
		}
	}

	stopInGroup(groupName: string, clipName: string) {
		const group = this.findGroup(groupName);
		if (group) {
			group.stop(clipName);
		} else {
			console.warn(`Group ${groupName} not found`);
		}
	}
}
