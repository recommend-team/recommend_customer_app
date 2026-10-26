import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import type { PickedPlace, PlaceSuggestion } from '../../../lib/contract';

/** Wait for a pause in typing before asking: every search is a paid request. */
const PAUSE_MS = 350;

function newSession(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * "What's the full delivery address?" — searched and picked from Google, so the rider
 * gets a real street and a pin rather than whatever was typed.
 *
 * Typing the address in the composer still works: the card is the easy way, not the
 * only one, and it steps aside if Google can't be reached. One session runs from the
 * first letter to the pick, so Google bills the search as one.
 *
 * Interactive only while it is the live question — from history it says nothing.
 */
export function AddressPickerCard({
  active,
  onPick,
}: {
  active: boolean;
  /** The pick's token for the server, and its address for the buyer's side of the thread. */
  onPick: (picked: PickedPlace) => void;
}) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  /** What the shown suggestions are for — so "no matches" only follows a real search. */
  const [searched, setSearched] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const session = useRef(newSession());

  useEffect(() => {
    const q = text.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await api.suggestPlaces(q, session.current);
        if (!cancelled) {
          setSuggestions(found);
          setSearched(q);
        }
      } catch {
        if (!cancelled) setDown(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, PAUSE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  if (!active) return null;

  if (down) {
    return (
      <p className="mt-1.5 max-w-[82%] rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 shadow-sm">
        Address search isn&apos;t available right now — type your address below.
      </p>
    );
  }

  const choose = async (suggestion: PlaceSuggestion) => {
    setResolving(suggestion.placeId);
    setFailure(null);
    try {
      const picked = await api.resolvePlace(
        suggestion.placeId,
        session.current,
      );
      // A pick ends the session; a fresh search after it is billed as a new one.
      session.current = newSession();
      onPick(picked);
    } catch {
      setFailure("Couldn't get that address — try again, or type it below.");
    } finally {
      setResolving(null);
    }
  };

  const q = text.trim();

  return (
    <div className="mt-1.5 w-full max-w-[88%] rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-hairline)] px-3 py-2 focus-within:border-[var(--color-orange)]">
        <PinIcon />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search your street or estate"
          aria-label="Search for your address"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink)]/40"
        />
        {searching && (
          <span className="text-[11px] text-[var(--color-ink)]/45">…</span>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Addresses"
          className="mt-1.5 divide-y divide-[var(--color-hairline)]"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                disabled={!!resolving}
                onClick={() => void choose(suggestion)}
                className="flex w-full flex-col items-start py-2 text-left transition active:opacity-60 disabled:opacity-50"
              >
                <span className="text-[14px] font-bold text-[var(--color-ink)]">
                  {suggestion.main}
                  {resolving === suggestion.placeId && ' …'}
                </span>
                <span className="text-[12px] text-[var(--color-ink)]/55">
                  {suggestion.secondary}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && q.length >= 3 && searched === q && !suggestions.length && (
        <p className="mt-2 text-[12px] text-[var(--color-ink)]/55">
          No matches yet — try the street name, or type the address below.
        </p>
      )}
      {failure && (
        <p className="mt-2 text-[12px] text-red-600" role="alert">
          {failure}
        </p>
      )}
      <p className="mt-2 text-center text-[12px] text-[var(--color-ink)]/45">
        Can&apos;t find it? Just type it below.
      </p>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 text-[var(--color-orange)]"
    >
      <path
        d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="9.5"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
