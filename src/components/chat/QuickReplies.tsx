import type { ChoicesData } from '../../lib/contract';

/**
 * Tappable answers to a question the bot just asked — the chips in the design reference.
 *
 * Tapping sends the label as an ordinary message rather than a special event. That keeps
 * one code path on the server: the checkout flow parses free text anyway, because a buyer
 * who types "I'll pick it up" must work exactly as well as one who taps.
 */
export function QuickReplies({
  data,
  onChoose,
}: {
  data: ChoicesData;
  onChoose: (label: string) => void;
}) {
  if (!data?.options?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {data.options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChoose(option.label)}
          className="rounded-full border border-white/60 bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-[var(--color-ink)] shadow-sm backdrop-blur-sm transition active:scale-[0.97] active:bg-white"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
