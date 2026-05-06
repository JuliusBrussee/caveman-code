import { Text } from "@cave/tui";
import { type Static, Type } from "@sinclair/typebox";
import { ClarifyPromptComponent } from "../../modes/interactive/components/clarify-prompt.js";
import type { ToolDefinition } from "../extensions/types.js";

const ClarifySchema = Type.Object({
	question: Type.String({ description: "The single question to ask the user." }),
	choices: Type.Optional(
		Type.Array(Type.String(), {
			description:
				"Optional list of preset answers. When set, the user picks one or types a free answer via the 'Other' option.",
		}),
	),
	allowFreeText: Type.Optional(
		Type.Boolean({ description: "If true (default when choices is empty), let the user type a free answer." }),
	),
});

export type ClarifyToolInput = Static<typeof ClarifySchema>;

export interface ClarifyToolDetails {
	answer: string | null;
}

export const clarifyToolDefinition: ToolDefinition<typeof ClarifySchema, ClarifyToolDetails> = {
	name: "clarify",
	label: "Clarify",
	description:
		"Ask the user a single clarifying question and pause until they answer. Use when the task is ambiguous and the wrong assumption would waste real effort. Choices are recommended when the answer is constrained.",
	promptSnippet: "Pause and ask the user a clarifying question",
	parameters: ClarifySchema,
	async execute(_id, params, signal, _onUpdate, ctx) {
		if (!ctx.hasUI) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Clarify is only available in interactive mode. Proceed with a best-guess answer or fail the task.",
					},
				],
				details: { answer: null },
			};
		}
		const answer = await ctx.ui.custom<string | null>(
			(tui, _theme, _kb, done) => {
				const component = new ClarifyPromptComponent({
					question: params.question,
					choices: params.choices,
					allowFreeText: params.allowFreeText,
					onSubmit: (s) => done(s),
					onCancel: () => done(null),
				});
				void tui;
				return component;
			},
			{ overlay: true, overlayOptions: { anchor: "center" } },
		);

		if (signal?.aborted) {
			return {
				content: [{ type: "text" as const, text: "Clarify cancelled (agent aborted)" }],
				details: { answer: null },
			};
		}
		if (answer === null) {
			return {
				content: [{ type: "text" as const, text: "User dismissed the clarify prompt without answering." }],
				details: { answer: null },
			};
		}
		return {
			content: [{ type: "text" as const, text: answer }],
			details: { answer },
		};
	},
	renderCall(args, theme) {
		const q = (args.question ?? "").slice(0, 80);
		const head = theme.fg("toolTitle", theme.bold("clarify"));
		return new Text(`${head} ${theme.fg("dim", q)}`, 0, 0);
	},
	renderResult(result, _options, theme) {
		const details = result.details as ClarifyToolDetails | undefined;
		if (!details || details.answer === null) {
			return new Text(theme.fg("dim", "(no answer)"), 0, 0);
		}
		return new Text(`${theme.fg("success", "→")} ${theme.fg("text", details.answer)}`, 0, 0);
	},
};

export { ClarifySchema };
