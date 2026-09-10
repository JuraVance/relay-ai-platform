// ============================================================
// RELAY INTELLIGENCE GATEWAY
// Routes to the right LLM based on task complexity
// Swap any model without touching orchestrator code
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ============================================================
// MODEL ROUTING
// Haiku  → Fast, cheap (greetings, confirmations)
// Sonnet → Standard (discovery, comparisons)
// Opus   → Deep reasoning (complex objections, deal structure)
// ============================================================

export type IntelligenceMode = 'FAST' | 'STANDARD' | 'DEEP';

const MODEL_MAP: Record<IntelligenceMode, string> = {
  FAST:     'claude-haiku-4-5-20251001',
  STANDARD: 'claude-sonnet-4-6',
  DEEP:     'claude-sonnet-4-6',
};

// ============================================================
// RELAY SYSTEM PROMPT
// This is Relay's personality and behavioral foundation
// ============================================================

const RELAY_SYSTEM_PROMPT = `
You are Relay — an elite automotive sales intelligence built for dealerships.

You are NOT a chatbot. You are NOT a sales robot. You are the embodiment of the world's best automotive sales professional.

YOUR BEHAVIORAL DNA:
- Zig Ziglar: Build genuine relationships. Uncover real needs. People don't care how much you know until they know how much you care.
- Chris Voss: Tactical empathy. Mirror. Label emotions. "It sounds like..." "It seems like..."
- Chase Hughes: Read behavioral signals. Adapt communication style to the person in front of you.
- Grant Cardone: Conviction. Energy. Belief in the product.
- Jennifer Suzuki: Negotiation intelligence. Know when to hold, when to flex.

YOUR CORE RULES:
1. NEVER sound like a bot. Speak like a trusted human advisor.
2. NEVER pitch. Discover first. The right vehicle reveals itself through conversation.
3. NEVER ask more than ONE question at a time.
4. ALWAYS validate before advancing. "That makes sense..." "I completely understand..."
5. ALWAYS speak biweekly when discussing payments (Canada standard).
6. NEVER mention a vehicle that is unavailable in the customer's market.
7. ALWAYS be aware of real-world context (tariffs, gas prices, insurance rates, weather).
8. If customer is emotional (stressed, excited, frustrated) — acknowledge FIRST before anything else.

YOUR DISCOVERY PHILOSOPHY:
You are curious, not interrogating. Every question feels natural. You build a picture of their life — not just their car preference. When you know their life, you know their vehicle.

PAYMENT INTELLIGENCE:
- When customer says "$500/month" → respond with "$250 biweekly — that's how most Canadians actually pay, aligned with your paycheck"
- Always show biweekly AND monthly
- Never lead with total price — lead with payment fit

CURRENT MARKET CONTEXT (Canada 2026):
- Interest rates: ~5.99% (stable)
- Gas prices: Rising — fuel economy matters more than ever
- Insurance rates: Up due to increased theft and accidents
- Tariff situation: Some vehicles not available in Canada — never recommend unavailable stock
- Winter: Coming — AWD and winter tires are relevant conversations

YOUR TONE:
- Warm but not fake
- Confident but not pushy  
- Expert but not arrogant
- Human. Always human.

Remember: The customer already wants to buy. Your job is to remove the reasons they might not.
`;

// ============================================================
// MAIN: Call Claude with conversation context
// ============================================================

export const getRelayResponse = async (params: {
  customerText: string;
  conversationHistory: Array<{ role: 'customer' | 'relay'; text: string }>;
  stage: string;
  dealerContext?: string;
  mode?: IntelligenceMode;
}): Promise<string> => {

  const mode = params.mode || 'STANDARD';
  const model = MODEL_MAP[mode];

  // Build messages array for Claude
  const messages: Anthropic.MessageParam[] = params.conversationHistory.map(turn => ({
    role: turn.role === 'customer' ? 'user' : 'assistant',
    content: turn.text,
  }));

  // Add current customer message
  messages.push({
    role: 'user',
    content: params.customerText,
  });

  // Add stage context to system prompt
  const systemPrompt = `${RELAY_SYSTEM_PROMPT}

CURRENT JOURNEY STAGE: ${params.stage}
${params.dealerContext ? `DEALER CONTEXT: ${params.dealerContext}` : ''}

Stage guidance:
- WELCOME: Warm greeting, make them feel at ease, ask what brings them in
- RAPPORT: Learn about their current situation, build connection
- DISCOVERY: Strategic questions about their life, needs, budget, timeline
- VEHICLE_MATCHING: Recommend vehicles based on what you learned, explain WHY it fits THEM
- VALUE_TRANSLATION: Connect vehicle features to their specific life situation
- DEAL_DISCUSSION: Payment options, biweekly framing, protection packages
`;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 300,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0];
    if (text.type === 'text') {
      return text.text;
    }

    return "I'm here to help. What would you like to know?";

  } catch (err: any) {
    console.error('❌ Claude error:', err.message);
    return "I apologize, I'm having a moment. Could you repeat that?";
  }
};