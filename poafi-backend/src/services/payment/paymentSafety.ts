/**
 * Payment simulation must be opt-in, non-production, and never used for live payments.
 */
export function isPaymentSimulationAllowed(
  nodeEnv: string | undefined,
  allowSimulation: boolean,
  isLive: boolean,
): boolean {
  return nodeEnv !== 'production' && allowSimulation && !isLive;
}
