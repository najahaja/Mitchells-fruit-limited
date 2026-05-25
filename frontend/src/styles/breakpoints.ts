// Standard breakpoints used across all Vaxis components.
// Mobile: ≤ 639px | Tablet: 640–1023px | Desktop: ≥ 1024px

export const BP = {
  mobile: 639,
  tablet: 1023,
} as const;

// CSS media query strings for use inside embedded <style> blocks.
export const MQ = {
  mobile:     `@media (max-width: 639px)`,
  tablet:     `@media (max-width: 1023px)`,
  tabletOnly: `@media (min-width: 640px) and (max-width: 1023px)`,
  desktop:    `@media (min-width: 1024px)`,
} as const;
