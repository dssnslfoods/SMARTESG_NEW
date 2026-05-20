// ─── Color utilities for white-label theming ──────────────────────────────────

/**
 * Convert a hex color (#rrggbb) to an HSL string in the
 * "H S% L%" format used by the shadcn/Tailwind CSS variables.
 * Returns null if the input isn't a valid 6-digit hex.
 */
export function hexToHslString(hex: string): string | null {
  if (!hex) return null;
  const m = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;

  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Parse a hex color into its H, S, L numeric components (0-360, 0-100, 0-100).
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const str = hexToHslString(hex);
  if (!str) return null;
  const [h, s, l] = str.replace(/%/g, '').split(' ').map(Number);
  return { h, s, l };
}

/**
 * Build a lighter tint of a hex color as an HSL string — used for the
 * --accent surface (subtle background of the brand color).
 */
export function tintHslString(hex: string, targetLightness = 94): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  // Keep hue, soften saturation, raise lightness for a pale surface
  const s = Math.min(hsl.s, 45);
  return `${hsl.h} ${s}% ${targetLightness}%`;
}

/**
 * Darker variant of the brand color (for accent-foreground text on the tint).
 */
export function darkenHslString(hex: string, targetLightness = 28): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  return `${hsl.h} ${hsl.s}% ${targetLightness}%`;
}
