import type { TipId } from "../components/OnboardingProvider";

export const markTipSeen = (tipId: TipId) => {
  window.dispatchEvent(new CustomEvent('onboarding-mark-seen', { detail: tipId }));
};

