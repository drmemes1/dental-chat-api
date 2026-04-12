# QSD Chat Widget Design Spec

Reference for Quentin Smile Dental chat widget styling and behavior.

## Brand Colors

| Name  | Hex       | Usage                              |
|-------|-----------|------------------------------------|
| Teal  | `#1E8A8A` | Primary actions, header, send btn  |
| Navy  | `#1B3A5F` | Header gradient, text accents      |
| White | `#FFFFFF` | Backgrounds, bot message bubbles   |

## Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Base size:** 15px
- **Header title:** 16px, semi-bold, white
- **Header subtitle:** 12px, regular, white (80% opacity)
- **Message text:** 15px, regular
- **Input text:** 15px, regular
- **Timestamp:** 11px, `#999`

## Component Styles

### Chat Bubble (Launcher)

- Size: 60px circle
- Background: `#1E8A8A`
- Icon: white tooth/chat icon, 28px
- Shadow: `0 4px 12px rgba(0,0,0,0.15)`
- Position: fixed, bottom-right (`bottom: 20px; right: 20px`)
- Hover: scale 1.1, shadow intensifies

### Widget Container

- Width: 380px (desktop), 100vw (mobile)
- Height: 520px (desktop), 100vh (mobile)
- Border radius: 16px (desktop), 0 (mobile)
- Shadow: `0 8px 32px rgba(0,0,0,0.15)`
- Background: `#F9FAFB`

### Header

- Height: 64px
- Background: linear gradient 135deg from `#1B3A5F` to `#1E8A8A`
- Content: tooth emoji + "Chat with Quentin" title + "Virtual Dental Assistant" subtitle
- Close button: top-right, white, 24px

### Message Bubbles

**Bot messages:**
- Background: `#FFFFFF`
- Border: `1px solid #E5E7EB`
- Border radius: `2px 16px 16px 16px`
- Max width: 80%
- Padding: 12px 16px
- Text color: `#1F2937`

**User messages:**
- Background: `#1E8A8A`
- Border radius: `16px 2px 16px 16px`
- Max width: 80%
- Padding: 12px 16px
- Text color: `#FFFFFF`

### Input Area

- Background: `#FFFFFF`
- Border top: `1px solid #E5E7EB`
- Input padding: 12px 16px
- Send button: 40px circle, `#1E8A8A`, white arrow icon
- Placeholder: "Type your message..." in `#9CA3AF`
- Border radius (bottom): matches container (16px desktop, 0 mobile)

### Typing Indicator

- Three dots in bot bubble style
- Dots: 8px circles, `#1E8A8A`
- Sequential bounce animation, 1.4s loop

## Animations

| Element          | Trigger   | Animation                                      | Duration | Easing              |
|------------------|-----------|-------------------------------------------------|----------|---------------------|
| Widget open      | Click     | Scale 0.8 → 1 + fade in                        | 300ms    | `ease-out`          |
| Widget close     | Click     | Scale 1 → 0.8 + fade out                       | 200ms    | `ease-in`           |
| Message appear   | New msg   | Slide up 10px + fade in                         | 200ms    | `ease-out`          |
| Typing dots      | Waiting   | Sequential Y translate -4px                     | 1.4s     | `ease-in-out` loop  |
| Send button      | Hover     | Background darken to `#176E6E`                  | 150ms    | `ease`              |
| Chat bubble      | Hover     | Scale 1.1                                       | 200ms    | `ease-out`          |
| Chat bubble      | Load      | Scale 0 → 1 bounce                             | 400ms    | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` |

## ADA Compliance

- **Focus management:** Visible focus rings on all interactive elements (`outline: 2px solid #1E8A8A, offset 2px`)
- **Keyboard navigation:** Tab through messages, input, send, close; Escape closes widget
- **ARIA labels:** `aria-label` on chat bubble ("Open chat"), send button ("Send message"), close button ("Close chat")
- **Live region:** Message container uses `aria-live="polite"` for screen reader announcements
- **Color contrast:** All text meets WCAG AA minimum (4.5:1 ratio)
  - White on Teal `#1E8A8A`: 4.5:1 (AA pass)
  - Dark text `#1F2937` on White: 16:1 (AAA pass)
- **Touch targets:** Minimum 44x44px for all interactive elements
- **Reduced motion:** Respect `prefers-reduced-motion` — disable animations when set
- **Screen reader:** Bot messages announced as "Quentin says: [message]"

## Responsive Breakpoints

- **Desktop (>768px):** Floating widget, 380x520px, rounded corners
- **Tablet (481-768px):** Floating widget, 360x480px
- **Mobile (≤480px):** Full-screen overlay, no border radius, bottom-anchored input

## Disclaimer Bar

- Position: bottom of chat, above input
- Text: "This chat is for general information only. Do not share personal health information."
- Font: 11px, `#6B7280`
- Background: `#F3F4F6`
- Below disclaimer: "Need help? Call (718) 339-8852" link in `#1E8A8A`
