/**
 * Defines the structure of an agent behavior configuration.
 * Behaviors can specify role, rules, planning instructions, and answer formatting,
 * and can extend other behaviors.
 */
export interface AgentBehavior {
  /** Optional role description for the agent (e.g., "You are a helpful assistant"). */
  role?: string;
  /** Optional rules or guidelines the agent must follow. */
  rules?: string;
  /** Optional planning instructions for multi-step reasoning. */
  planning?: string;
  /** Optional formatting instructions for answers. */
  answer?: string;
  /** Optional name of another behavior to extend/inherit from. */
  extends?: string;
}

/**
 * Union type for the keys of AgentBehavior sections.
 * Used for dynamic access and validation of behavior properties.
 */
export type BehaviorSection = "role" | "rules" | "planning" | "answer" | "extends";