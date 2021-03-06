import { Collection, GuildChannel, Snowflake, VoiceChannel, VoiceState } from "discord.js";
import { Plugin } from "../typedef/Plugin";

const indexableChannelRegex = /([\w ]+) (\d+)/;

export default class VoiceScaling extends Plugin<{}> {
	inject(): void {
		// Register a handler for guildmembers joining/leaving/switching voice channels.
		this.context.client.on("voiceStateUpdate", (o, n) => this.updateChannels(o, n));
	}

	updateChannels(oldVoiceState: VoiceState, newVoiceState: VoiceState): void {
		// Construct an array of the channels they joined and left, and iterate over it.
		[oldVoiceState.channel, newVoiceState.channel].forEach((channel) => {
			if (!channel || channel.name.match(indexableChannelRegex) == null) return;

			const emptyChannelDuplicates = this.findDuplicateChannels(channel).filter((x) => x.members.size == 0);
			if (emptyChannelDuplicates.size == 0) channel.clone({ name: this.newNameFromExisting(channel), parent: channel.parentID });
			else {
				return emptyChannelDuplicates
					.array()
					.slice(1)
					.map((chan) => chan.delete());
			}
		});
	}

	// Identify all voice channels in the same category (or the root) with the same name.
	findDuplicateChannels(channel: GuildChannel): Collection<Snowflake, GuildChannel> {
		return channel.guild.channels.cache
			.filter((x) => x.type == "voice" && x.parentID == channel.parentID)
			.filter((x) => x.name.match(indexableChannelRegex) != null) // Filter out channels that aren't indexable
			.filter((x) => x.name.match(indexableChannelRegex)[1] == channel.name.match(indexableChannelRegex)[1]) // Filter out channels that aren't part of the same group
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	// Get the numbers of all channels with the same name
	getDuplicateChannelIDs(channel: VoiceChannel): number[] {
		return this.findDuplicateChannels(channel).map((c) => Number(c.name.match(indexableChannelRegex)[2]));
	}

	// Get a new channel number suffix
	static newIndex(primaryKeys: Array<number>): number {
		let key = 1;
		let index = 0;
		while (key++ == primaryKeys[index++]);
		return --key;
	}

	// Generate a new name from the name of an existing channel.
	newNameFromExisting(channel: VoiceChannel): string {
		return `${channel.name.match(indexableChannelRegex)[1]} ${VoiceScaling.newIndex(this.getDuplicateChannelIDs(channel))}`;
	}

	extract(): void {
		this.context.client.off("voiceStateUpdate", this.updateChannels);
	}
}
