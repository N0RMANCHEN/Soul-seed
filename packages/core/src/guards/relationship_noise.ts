/**
 * H/P1-13 — Relationship Noise Guard
 *
 * Controls relationship card injection frequency and weight.
 * Archive §20.2: confidence threshold, 1–2 cards hard cap, cards short and relevant.
 */

import {
  generateRelationshipCardsForInput,
  MAX_CARDS_PER_TURN,
  MAX_CARD_CHARS,
} from "../people_registry.js";
import type { RelationshipState } from "../types.js";

export interface RelationshipNoiseConfig {
  schemaVersion?: string;
  maxCardsPerTurn?: number;
  maxCharsPerCard?: number;
  minLinkingConfidence?: number;
}

/**
 * Generate relationship cards with noise guard applied.
 * Enforces config-driven limits (max cards, max chars).
 */
export async function generateRelationshipCardsWithNoiseGuard(
  rootPath: string,
  userInput: string,
  relationshipState: RelationshipState,
  config?: RelationshipNoiseConfig
): Promise<string[]> {
  const maxCards = Math.min(
    config?.maxCardsPerTurn ?? MAX_CARDS_PER_TURN,
    MAX_CARDS_PER_TURN
  );
  const maxChars = config?.maxCharsPerCard ?? MAX_CARD_CHARS;

  const cards = await generateRelationshipCardsForInput(rootPath, userInput, relationshipState, {
    maxCards,
    maxCharsPerCard: maxChars,
  });

  return cards.slice(0, maxCards);
}
