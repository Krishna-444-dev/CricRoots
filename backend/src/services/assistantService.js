const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const Tournament = require('../models/Tournament');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 10;
const MAX_RESPONSE_TOKENS = 1024;

// Read once at startup, not per-request - these files don't change without a deploy.
const APP_HELP_CONTENT = fs.readFileSync(path.join(__dirname, '../data/appHelpContent.md'), 'utf-8');
const CRICKET_RULES_SUMMARY = fs.readFileSync(path.join(__dirname, '../data/cricketRulesSummary.md'), 'utf-8');

const SYSTEM_INSTRUCTIONS = `You are the in-app assistant for CricRoots, a cricket club/tournament
management app. Answer questions about how to use the app, and general cricket rules questions,
using ONLY the reference material provided below (and the tournament-specific house rules, if any,
provided separately). If something isn't covered by the provided material, say plainly that you
don't have that information rather than guessing at app features or rules that aren't described.
Keep answers concise and conversational - a couple of short paragraphs at most, not an exhaustive
essay. If a tournament's house rules are provided and relevant to the question, prioritize them over
the general cricket rules summary.`;

let anthropicClient = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Builds the system prompt as cache-control-marked blocks. The static reference
 * material (app help + cricket rules) is marked ephemeral-cacheable so repeated
 * questions - even from different users - don't re-bill the full reference text on
 * every request, only the (usually much smaller) per-tournament house rules and the
 * user's own question. This is the actual cost lever, more than the model choice.
 */
async function buildSystemPrompt(tournamentId) {
  const blocks = [
    { type: 'text', text: SYSTEM_INSTRUCTIONS },
    // Combined into ONE cache_control block rather than one per file: Claude Haiku
    // models require a minimum of ~2048 tokens per individual cache-marked block to be
    // cache-eligible at all. Each file alone is ~1,300-1,400 tokens - under the
    // per-block minimum on its own - but comfortably over it combined. Splitting them
    // felt more organized while writing this, but silently disabled caching entirely
    // (confirmed via cache_write/cache_read both reading 0 in production usage logs
    // before this fix) - a real, measured bug, not a hypothetical one.
    {
      type: 'text',
      text: `# App Help Reference\n\n${APP_HELP_CONTENT}\n\n# Cricket Rules Reference\n\n${CRICKET_RULES_SUMMARY}`,
      cache_control: { type: 'ephemeral' }
    }
  ];

  if (tournamentId) {
    const tournament = await Tournament.findById(tournamentId).select('name houseRules');
    if (tournament && tournament.houseRules) {
      blocks.push({
        type: 'text',
        text: `# House Rules for "${tournament.name}"\n\nThese override the general cricket rules reference above for anything they cover.\n\n${tournament.houseRules}`
      });
    }
  }

  return blocks;
}

/**
 * `history` is the prior turns of this conversation as the client already has them
 * ({role, content}[]), trimmed to the most recent MAX_HISTORY_TURNS - the client owns
 * conversation state (no server-side chat session storage), same "compute on demand,
 * don't persist derived state" philosophy already used for stats/insights elsewhere
 * in this codebase.
 */
async function askAssistant({ message, history = [], tournamentId }) {
  if (!isConfigured()) {
    return {
      configured: false,
      reply: "The assistant isn't set up yet - ask your app admin to add an Anthropic API key."
    };
  }

  const trimmedMessage = String(message || '').slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmedMessage.trim()) {
    throw new Error('message is required');
  }

  const recentHistory = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_TURNS)
    .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map(h => ({ role: h.role, content: h.content.slice(0, MAX_MESSAGE_LENGTH) }));

  const client = getClient();
  const system = await buildSystemPrompt(tournamentId);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_RESPONSE_TOKENS,
    system,
    messages: [...recentHistory, { role: 'user', content: trimmedMessage }]
  });

  const textBlock = response.content.find(block => block.type === 'text');

  // Server-side only - lets cost be monitored via `docker logs` against the Anthropic
  // console's billing dashboard without exposing token counts to the client.
  const u = response.usage;
  console.log(
    `[assistant] input=${u.input_tokens} output=${u.output_tokens} ` +
    `cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`
  );

  return {
    configured: true,
    reply: textBlock ? textBlock.text : "I couldn't generate a response - try rephrasing your question.",
    usage: response.usage
  };
}

module.exports = { askAssistant, isConfigured, MAX_MESSAGE_LENGTH };
