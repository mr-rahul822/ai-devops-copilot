---
name: Obsidian Nebula
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#bbc9cf'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#859398'
  outline-variant: '#3c494e'
  surface-tint: '#3cd7ff'
  primary: '#a8e8ff'
  on-primary: '#003642'
  primary-container: '#00d4ff'
  on-primary-container: '#00586b'
  inverse-primary: '#00677e'
  secondary: '#d2bbff'
  on-secondary: '#3f008e'
  secondary-container: '#6001d1'
  on-secondary-container: '#c9aeff'
  tertiary: '#e0dde5'
  on-tertiary: '#303036'
  tertiary-container: '#c4c1c9'
  on-tertiary-container: '#504f55'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b4ebff'
  primary-fixed-dim: '#3cd7ff'
  on-primary-fixed: '#001f27'
  on-primary-fixed-variant: '#004e5f'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#e4e1e9'
  tertiary-fixed-dim: '#c8c5cd'
  on-tertiary-fixed: '#1b1b20'
  on-tertiary-fixed-variant: '#47464c'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  unit: 4px
---

## Brand & Style

The design system is engineered for a high-performance, developer-centric DevOps platform. The brand personality is technical, futuristic, and hyper-efficient, prioritizing speed and clarity through a sophisticated dark-mode interface. 

The aesthetic sits at the intersection of **Glassmorphism** and **Minimalism**, heavily inspired by the "Linear" and "Vercel" design movements. It utilizes deep layering, translucent surfaces, and vibrant glow effects to create a sense of depth and focus. The emotional response should be one of complete control over complex systems—providing a "command center" atmosphere that feels both premium and indestructible.

## Colors

The palette is anchored by a deep obsidian background (`#0a0a0f`), which provides the canvas for high-visibility accents. 

- **Primary Electric Blue (#00d4ff):** Used for critical actions, active states, and focus indicators. 
- **Secondary Purple (#7c3aed):** Used for secondary features, data visualization, and depth through gradients.
- **Accents:** Soft Cyan gradients transition between primary and secondary colors to represent data flow and connectivity.
- **Surface Layering:** Neutral tones are used sparingly for text and icons, maintaining high contrast against the dark background while avoiding pure white to reduce eye strain.

## Typography

This design system utilizes a dual-sans-serif approach to balance technical precision with readability. 

**Geist** is the primary typeface for headlines and interactive elements, providing a geometric, "developer-friendly" feel that aligns with the monospaced aesthetic of coding environments. **Inter** is utilized for body copy to ensure maximum legibility during long-form reading and documentation. 

A third typeface, **JetBrains Mono**, is introduced specifically for terminal outputs, code snippets, and system logs to reinforce the DevOps utility of the platform.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with generous whitespace to prevent visual clutter in data-heavy environments. 

- **Desktop:** A 12-column grid with 24px gutters. Content is often centered with significant side margins to maintain focus.
- **Tablet:** 8-column grid with 16px gutters.
- **Mobile:** 4-column grid with 16px margins. 

The spacing rhythm is built on a 4px baseline unit. Component padding should lean towards "airy" (e.g., 16px or 24px) to allow the glassmorphic effects to breathe.

## Elevation & Depth

Hierarchy is established through **Glassmorphism** and light-based elevation rather than traditional shadows.

1. **Base Layer:** The `#0a0a0f` background.
2. **Glass Planes:** Translucent containers use a `12px` backdrop-blur and a `1px` solid border (`rgba(255,255,255,0.1)`). 
3. **Luminous Glows:** Active elements or elevated cards use a soft outer glow (0px 0px 20px) tinted with the primary blue or purple, simulating a light source beneath the glass.
4. **Z-axis:** Higher elevation is communicated through increased background transparency (lighter fills) and sharper border highlights on the top and left edges to simulate a "rim light."

## Shapes

The design system employs a distinct **Rounded** shape language to soften the high-tech edge of the dark theme. 

- **Standard Containers:** Use 24px (`rounded-xl` equivalent) for large cards and layout sections.
- **Interactive Elements:** Buttons and input fields use a pill-shape (full radius) to contrast against the structured grid of the layout.
- **Terminal/Code blocks:** These maintain a slightly sharper 8px radius to denote their technical, "raw" nature.

## Components

### Buttons
Primary buttons are pill-shaped with a vibrant Electric Blue fill and a subtle inner-glow. On hover, they should emit a soft cyan drop-shadow glow. Secondary buttons use the glassmorphic style: a translucent fill with a 1px border.

### Glass Cards
Cards are the primary container. They must feature a `12px` backdrop blur. The border should have a subtle linear gradient from `rgba(255,255,255,0.15)` at the top-left to `rgba(255,255,255,0.05)` at the bottom-right.

### Terminal UI
Command-line interfaces and logs should use a solid `#000000` background within a glass container. Text must be `JetBrains Mono` in Primary Blue or White. Use "Powerline" style chevrons for breadcrumbs.

### Input Fields
Inputs are pill-shaped or 12px rounded rectangles with a `1px` border. When focused, the border glows Electric Blue, and the backdrop-blur intensity increases.

### Status Chips
Small, high-contrast indicators. "Live" states should include a breathing "pulse" animation with the glow effect.