/**
 * Three bouncing dots in an assistant-shaped bubble.
 *
 * This carries real weight: discovery runs a model call plus catalogue lookups and takes
 * five to ten seconds. Without a visible signal that something is happening, the chat
 * reads as broken rather than thinking.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="bubble-tail bubble-tail-left relative rounded-2xl rounded-tl-md bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          {[0, 0.15, 0.3].map((delay) => (
            <span
              key={delay}
              className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--color-muted)]"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
