/**
 * A simple chat-bubble icon — not the WhatsApp trademark logo.
 * Used for the "Order on WhatsApp" button.
 */
export default function ChatBubble({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2C6.48 2 2 6.02 2 11c0 2.42 1.07 4.61 2.81 6.21L4 22l4.93-1.6c.97.27 2 .4 3.07.4 5.52 0 10-4.02 10-9S17.52 2 12 2z"
        fill="currentColor"
      />
      <path
        d="M8.5 10.5c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"
        fill="white"
      />
      <path
        d="M15.5 10.5c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"
        fill="white"
      />
    </svg>
  );
}
