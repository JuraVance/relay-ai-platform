// ============================================================
// RELAY ORCHESTRATOR
// The brain. Owns state, policy, journey, tools, audit.
// Claude is a reasoning component. Relay owns everything else.
// ============================================================

import { supabase } from '../services/supabase';

// ============================================================
// JOURNEY STAGES
// ============================================================

export type JourneyStage =
  | 'WELCOME'
  | 'RAPPORT'
  | 'DISCOVERY'
  | 'VEHICLE_MATCHING'
  | 'VALUE_TRANSLATION'
  | 'DEAL_DISCUSSION'
  | 'TRADE_APPRAISAL'
  | 'IDV'
  | 'TRANSACTION'
  | 'COMPLETED'
  | 'ABANDONED';

// Valid stage transitions (Relay controls this, not Claude)
const VALID_TRANSITIONS: Record<JourneyStage, JourneyStage[]> = {
  WELCOME:            ['RAPPORT'],
  RAPPORT:            ['DISCOVERY'],
  DISCOVERY:          ['VEHICLE_MATCHING'],
  VEHICLE_MATCHING:   ['VALUE_TRANSLATION', 'DISCOVERY'],
  VALUE_TRANSLATION:  ['DEAL_DISCUSSION', 'VEHICLE_MATCHING'],
  DEAL_DISCUSSION:    ['TRADE_APPRAISAL', 'IDV', 'VEHICLE_MATCHING'],
  TRADE_APPRAISAL:    ['DEAL_DISCUSSION'],
  IDV:                ['TRANSACTION'],
  TRANSACTION:        ['COMPLETED'],
  COMPLETED:          [],
  ABANDONED:          [],
};

// ============================================================
// SESSION STATE
// ============================================================

export interface SessionState {
  sessionId: string;
  dealerId: string;
  currentStage: JourneyStage;
  customerPhone?: string;
  customerName?: string;
  language: string;
  
  // Customer profile (built during discovery)
  profile: {
    communicationStyle?: 'analytical' | 'driver' | 'expressive' | 'amiable';
    buyingTemperature: number; // 0-100
    hasKids?: boolean;
    commute?: string;
    primaryUse?: string;
    budgetMonthly?: number;
    budgetBiweekly?: number;
    paymentType?: 'lease' | 'finance' | 'cash';
    hasTrade?: boolean;
    tradeInfo?: Record<string, any>;
  };

  // Vehicle interest
  vehiclesDiscussed: string[];
  selectedVehicleId?: string;

  // Deal
  dealId?: string;

  // Conversation
  turnCount: number;
  conversationHistory: ConversationTurn[];
}

export interface ConversationTurn {
  role: 'customer' | 'relay';
  text: string;
  timestamp: Date;
}

// ============================================================
// ORCHESTRATOR CLASS
// ============================================================

export class RelayOrchestrator {
  private dealerId: string;

  constructor(dealerId: string) {
    this.dealerId = dealerId;
  }

  // ----------------------------------------------------------
  // START: Create new session
  // ----------------------------------------------------------

  async startSession(params: {
    kioskId?: string;
    language?: string;
    customerPhone?: string;
  }): Promise<SessionState> {

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        dealer_id: this.dealerId,
        kiosk_id: params.kioskId,
        language: params.language || 'en',
        customer_phone: params.customerPhone,
        current_stage: 'WELCOME',
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create session: ${error.message}`);

    // Log event
    await this.logEvent(data.id, 'session_started', {
      kiosk_id: params.kioskId,
      language: params.language || 'en',
    });

    console.log(`✅ Session started: ${data.id}`);

    return {
      sessionId: data.id,
      dealerId: this.dealerId,
      currentStage: 'WELCOME',
      language: params.language || 'en',
      profile: { buyingTemperature: 0 },
      vehiclesDiscussed: [],
      turnCount: 0,
      conversationHistory: [],
    };
  }

  // ----------------------------------------------------------
  // PROCESS: Handle customer input, return Relay response
  // ----------------------------------------------------------

  async processInput(
    state: SessionState,
    customerText: string
  ): Promise<{ response: string; updatedState: SessionState }> {

    // Log customer utterance
    await this.logEvent(state.sessionId, 'utterance_received', {
      text: customerText,
      stage: state.currentStage,
      turn: state.turnCount,
    });

    // Add to conversation history
    state.conversationHistory.push({
      role: 'customer',
      text: customerText,
      timestamp: new Date(),
    });

    // Store turn in database
    await supabase.from('conversation_turns').insert({
      session_id: state.sessionId,
      turn_number: state.turnCount,
      customer_text: customerText,
    });

    // Get Relay response based on stage
    const response = await this.getRelayResponse(state, customerText);

    // Add Relay response to history
    state.conversationHistory.push({
      role: 'relay',
      text: response,
      timestamp: new Date(),
    });

    // Update turn in database
    await supabase.from('conversation_turns')
      .update({ relay_text: response })
      .eq('session_id', state.sessionId)
      .eq('turn_number', state.turnCount);

    // Increment turn count
    state.turnCount++;

    // Check if stage should advance
    const updatedState = await this.evaluateStageTransition(state, customerText, response);

    return { response, updatedState };
  }

  // ----------------------------------------------------------
  // STAGE TRANSITION: Relay controls when to advance
  // ----------------------------------------------------------

  async advanceStage(
    state: SessionState,
    nextStage: JourneyStage
  ): Promise<SessionState> {

    const validNext = VALID_TRANSITIONS[state.currentStage];

    if (!validNext.includes(nextStage)) {
      console.warn(`Invalid transition: ${state.currentStage} → ${nextStage}`);
      return state;
    }

    // Update database
    await supabase
      .from('sessions')
      .update({ 
        current_stage: nextStage,
        last_activity_at: new Date(),
      })
      .eq('id', state.sessionId);

    // Log event
    await this.logEvent(state.sessionId, 'journey_stage_changed', {
      from: state.currentStage,
      to: nextStage,
    });

    console.log(`🚀 Stage: ${state.currentStage} → ${nextStage}`);

    return { ...state, currentStage: nextStage };
  }

  // ----------------------------------------------------------
  // RESPONSE: Get Relay response for current stage
  // ----------------------------------------------------------

  private async getRelayResponse(
    state: SessionState,
    customerText: string
  ): Promise<string> {

    switch (state.currentStage) {
      case 'WELCOME':
        return this.handleWelcome(state, customerText);
      case 'RAPPORT':
        return this.handleRapport(state, customerText);
      case 'DISCOVERY':
        return this.handleDiscovery(state, customerText);
      case 'VEHICLE_MATCHING':
        return this.handleVehicleMatching(state, customerText);
      default:
        return "I'm here to help. What would you like to know?";
    }
  }

  // ----------------------------------------------------------
  // STAGE HANDLERS (Stub — Claude integration coming next)
  // ----------------------------------------------------------

  private async handleWelcome(state: SessionState, input: string): Promise<string> {
    return `Welcome to ${state.dealerId === process.env.DEALER_ID ? 'NewRoads Mazda' : 'our dealership'}. I'm Relay, your personal automotive guide. I'm here to make finding your next vehicle genuinely enjoyable. What brings you in today?`;
  }

  private async handleRapport(state: SessionState, input: string): Promise<string> {
    return `That's helpful to know. Tell me more — what's your current situation with your vehicle?`;
  }

  private async handleDiscovery(state: SessionState, input: string): Promise<string> {
    return `I want to make sure I find exactly the right fit for you. Can you tell me a bit about how you use your vehicle day to day?`;
  }

  private async handleVehicleMatching(state: SessionState, input: string): Promise<string> {
    return `Based on what you've shared, I have some great options in mind. Let me pull those up for you.`;
  }

  // ----------------------------------------------------------
  // STAGE EVALUATION: Should we advance?
  // ----------------------------------------------------------

  private async evaluateStageTransition(
    state: SessionState,
    customerText: string,
    relayResponse: string
  ): Promise<SessionState> {

    // Simple rules for now (Claude will handle this later)
    if (state.currentStage === 'WELCOME' && state.turnCount >= 1) {
      return this.advanceStage(state, 'RAPPORT');
    }

    if (state.currentStage === 'RAPPORT' && state.turnCount >= 2) {
      return this.advanceStage(state, 'DISCOVERY');
    }

    return state;
  }

  // ----------------------------------------------------------
  // EVENT LOGGER (Append-only audit trail)
  // ----------------------------------------------------------

  async logEvent(
    sessionId: string,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    await supabase.from('relay_events').insert({
      session_id: sessionId,
      dealer_id: this.dealerId,
      event_type: eventType,
      payload,
    });
  }
}