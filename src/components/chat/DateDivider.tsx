/** The centred "TODAY" pill from the reference, shown when the day changes. */
export function DateDivider({ iso }: { iso: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold tracking-widest text-[var(--color-muted)] uppercase shadow-sm">
        {label(iso)}
      </span>
    </div>
  );
}

function label(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    // Only show the year when it is not the current one.
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
