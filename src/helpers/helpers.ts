import { stripIndents } from "common-tags";
import { GuildMember, Message, Role } from "discord.js";
import { mkdirSync, readFile, writeFileSync } from "fs";
import { safeLoad } from "js-yaml";
import { dirname } from "path";
import { promisify } from "util";
import { CommunicationEvent } from "../typedef/CommunicationEvent";
import { ConfigElement } from "../typedef/ConfigElement";
import { Dictionary } from "../typedef/Dictionary";
import { Intent } from "../typedef/Intent";
import { ResolutionMethods } from "../typedef/ResolutionMethods";

export function randomElementFromArray<T>(array: Array<T>): T {
	return array[Math.floor(Math.random() * array.length)];
}

export function responseToQuestion(eventData: CommunicationEvent): Promise<string> {
	return new Promise((resolve) => {
		const response = randomElementFromArray(eventData.config.questionData.defaultResponses);

		if (eventData.source == "text") {
			// Only allow the question/response flow on text chats
			eventData.responseCallback(randomElementFromArray(eventData.config.questionData.question));

			// eslint-disable-next-line prefer-const
			let timeout: NodeJS.Timeout;

			const eventFunc = function(message: Message): void {
				if (message.author.id == eventData.author.id) {
					// If this is the person we're listening for
					clearTimeout(timeout); // Clear the timeout
					eventData.bot.client.off("message", eventFunc); // Clear this event listener

					eventData.responseCallback(randomElementFromArray(eventData.config.questionData.answeredResponse)); // Send the message that we're done here
					resolve(message.cleanContent); // Resolve the promise
				}
			};

			timeout = setTimeout(() => {
				// Set up a timeout for when to stop listening
				eventData.bot.client.off("message", eventFunc); // Clear the event listener

				eventData.responseCallback(randomElementFromArray(eventData.config.questionData.timeoutResponse));
				resolve(response);
			}, eventData.config.questionData.timeout);

			eventData.bot.client.on("message", eventFunc);
		} else {
			resolve(response);
		}
	});
}

export function valuesOf<T>(obj: { [key: string]: T }): T[] {
	return Object.keys(obj).map((prop: string) => obj[prop]);
}

function resolveConflict<T>(method: ResolutionMethods, defaults: Dictionary<T>, custom: Dictionary<T>): Dictionary<T> {
	const m = {
		[ResolutionMethods.UseDefault]: (defaults: Dictionary<T>): Dictionary<T> => defaults,
		[ResolutionMethods.UseCustom]: (defaults: Dictionary<T>, custom: Dictionary<T>): Dictionary<T> => custom,
		[ResolutionMethods.MergePreferCustom]: (defaults: Dictionary<T>, custom: Dictionary<T>): Dictionary<T> => {
			return { ...defaults, ...custom };
		},
		[ResolutionMethods.MergePreferDefault]: (defaults: Dictionary<T>, custom: Dictionary<T>): Dictionary<T> => {
			return { ...custom, ...defaults };
		},
	};

	return m[method](defaults, custom);
}

const readFileP = promisify(readFile);

export function parseConfig(): Promise<ConfigElement> {
	return Promise.all([
		readFileP("./config/defaults.yaml"),
		readFileP("./config/config.yaml").catch(() => {
			if (process.env.BotConfig) return Buffer.from(process.env.BotConfig);
			else throw new Error("Required custom configuration not found. Create a config file or provide via environment variable.");
		}),
	]).then((data) => {
		const defaultConfig: ConfigElement = safeLoad(data[0].toString());
		const customConfig: ConfigElement = safeLoad(data[1].toString());

		if (customConfig === undefined) throw new Error("Malformed configuration data.");

		const resolvedConfig = { ...defaultConfig, ...customConfig }; // Merge preferring custom data

		resolvedConfig.intents = resolveConflict<Intent>(resolvedConfig.intentsResolutionMethod, defaultConfig.intents, customConfig.intents);
		resolvedConfig.plugins = resolveConflict<any>(resolvedConfig.pluginsResolutionMethod, defaultConfig.plugins, customConfig.plugins);

		return resolvedConfig;
	});
}

export function roleStringify(role: Role): string {
	return `{name: ${role.name}, id: ${role.id}, guild: ${role.guild.id}, editable?: ${role.editable}}`;
}

export function memberStringify(member: GuildMember): string {
	return `{name: ${member.displayName}, id: ${member.id}, guild: ${member.guild.id}}`;
}

export function injectErrorLogger(): void {
	process.addListener("uncaughtException", (error) => {
		const path = `./fatals/${Date.now()}.log`;

		console.error(`Fatal error. See crash dump: ${path}`);

		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			[
				// The values for "META_VERSION" and "META_HASH" are filled in at build time.
				// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
				// @ts-ignore
				`Version: v${META_VERSION} / ${META_HASH}`,
				`Error: ${error.name}: ${error.message}`,
				stripIndents`
					Trace:
					${error.message}
					${error.stack}
				`,
			].join("\n\n")
		);

		process.exit(1);
	});
}