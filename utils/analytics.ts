/**
 * Google Analytics 4 utility for tracking user events
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Check if analytics is available
 */
function isAnalyticsAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Track a custom event
 */
export function trackEvent(
  eventName: string,
  parameters?: Record<string, any>
): void {
  if (!isAnalyticsAvailable()) return;

  try {
    window.gtag!('event', eventName, parameters);
  } catch (e) {
    console.warn('Analytics event tracking failed:', e);
  }
}

/**
 * Track page view (called automatically, but can be used for SPA navigation)
 */
export function trackPageView(pagePath?: string, pageTitle?: string): void {
  if (!isAnalyticsAvailable()) return;

  try {
    window.gtag!('event', 'page_view', {
      page_path: pagePath || window.location.pathname,
      page_title: pageTitle || document.title
    });
  } catch (e) {
    console.warn('Analytics page view tracking failed:', e);
  }
}

// ============================================
// Application-specific tracking functions
// ============================================

/**
 * Track when a user generates a new challenge
 */
export function trackChallengeGenerated(difficulty: string, topic?: string): void {
  trackEvent('challenge_generated', {
    difficulty,
    topic: topic || 'random',
    event_category: 'engagement'
  });
}

/**
 * Track when a user submits a design for evaluation
 */
export function trackDesignEvaluated(score: number, componentCount: number): void {
  trackEvent('design_evaluated', {
    score,
    component_count: componentCount,
    event_category: 'engagement'
  });
}

/**
 * Track when a user requests hints
 */
export function trackHintsRequested(): void {
  trackEvent('hints_requested', {
    event_category: 'engagement'
  });
}

/**
 * Track when a user views a solution
 */
export function trackSolutionViewed(): void {
  trackEvent('solution_viewed', {
    event_category: 'engagement'
  });
}

/**
 * Track when a user uses the AI tutor
 */
export function trackTutorMessage(): void {
  trackEvent('tutor_message_sent', {
    event_category: 'engagement'
  });
}

/**
 * Track when a user adds a component to the canvas
 */
export function trackComponentAdded(componentType: string): void {
  trackEvent('component_added', {
    component_type: componentType,
    event_category: 'design'
  });
}

/**
 * Track when a user configures their AI provider
 */
export function trackProviderConfigured(provider: string): void {
  trackEvent('provider_configured', {
    provider,
    event_category: 'settings'
  });
}

/**
 * Track when a user exports their design
 */
export function trackDesignExported(format: string): void {
  trackEvent('design_exported', {
    format,
    event_category: 'engagement'
  });
}

/**
 * Track errors for debugging
 * NOTE: Error messages are NOT sent to prevent PII leakage
 */
export function trackError(errorType: string, errorMessage: string): void {
  trackEvent('error_occurred', {
    error_type: errorType,
    // Do not send error_message to prevent PII leakage
    event_category: 'error'
  });
}

/**
 * Track session start with basic info
 */
export function trackSessionStart(): void {
  trackEvent('session_start', {
    event_category: 'session',
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`
  });
}
