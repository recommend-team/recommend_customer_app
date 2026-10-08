import { useEffect, useState, type ReactNode } from 'react';
import { Sheet } from '../ui/Sheet';
import { ShareGlyph } from '../pwa/InstallPrompt';
import { useInstallState } from '../../hooks/useInstallPrompt';
import { useAccount } from '../../hooks/useAccount';
import {
  installRoute,
  isInstalled,
  isIosSafari,
  promptInstall,
} from '../../lib/install';
import { currentPushState, enableOrderAlerts } from '../../lib/push';
import { chatClient } from '../../lib/socket';
import {
  FAQ_URL,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE,
  SUPPORT_PHONE_HREF,
} from '../../lib/support';

/**
 * The header's ⋮ menu: the things a buyer may have waved away, kept within reach.
 *
 * The install banner and the order-alerts offer each ask once, and a closed one is gone
 * for good. This is where someone who closed either by mistake — or changed their mind —
 * finds them again, along with a way to reach a person.
 */
export function AppMenu({
  open,
  onClose,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  /** Open the sign-in sheet. The menu closes first — one sheet at a time. */
  onSignIn: () => void;
}) {
  return (
    <Sheet open={open} title="Menu" onClose={onClose}>
      <div className="flex flex-col gap-2 pb-3">
        {open && <AccountRow onSignIn={onSignIn} />}
        <InstallRow />
        {/* Remounted on each open, so it re-reads permission the buyer may have changed. */}
        {open && <AlertsRow />}

        <p className="mt-3 px-1 text-[11px] font-bold tracking-widest text-[var(--color-muted)] uppercase">
          Help &amp; contact
        </p>
        <LinkRow
          href={SUPPORT_PHONE_HREF}
          icon={<PhoneIcon />}
          title="Call us"
          detail={`${SUPPORT_PHONE} · ${SUPPORT_HOURS}`}
        />
        <LinkRow
          href={`mailto:${SUPPORT_EMAIL}`}
          icon={<MailIcon />}
          title="Email us"
          detail={SUPPORT_EMAIL}
        />
        <LinkRow
          href={FAQ_URL}
          external
          icon={<QuestionIcon />}
          title="Questions & answers"
          detail="Delivery, payment, pickup and more"
        />
      </div>
    </Sheet>
  );
}

/**
 * Signed in or not. Signing out asks once more first: this browser starts a fresh chat,
 * which looks alarming if it was a slip — though nothing in the account is lost.
 */
function AccountRow({ onSignIn }: { onSignIn: () => void }) {
  const { email, known } = useAccount();
  const [confirming, setConfirming] = useState(false);

  // Nothing until the server answers, so a signed-in buyer never sees "Sign in" flash.
  if (!known) return null;

  if (!email) {
    return (
      <Row
        icon={<PersonIcon />}
        tone="orange"
        title="Keep your chats on any device"
        detail="Sign in with your email — no password."
        action={
          <ActionButton tone="orange" onClick={onSignIn}>
            Sign in
          </ActionButton>
        }
      />
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <Badge tone="brand">
          <PersonIcon />
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-[var(--color-ink)]">
            {email}
          </p>
          <p className="text-[12px] text-[var(--color-ink)]/55">
            Signed in · your chats follow you
          </p>
        </div>
        {!confirming && (
          <button
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-xl px-2.5 py-2 text-[12px] font-bold text-[var(--color-ink)]/60 transition active:bg-black/5"
          >
            Sign out
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2.5">
          <p className="text-[12px] leading-snug text-[var(--color-ink)]/70">
            This browser will start a new chat. Your chats and orders stay in
            your account — sign in again to see them.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                setConfirming(false);
                chatClient.signOut();
              }}
              className="rounded-xl bg-[var(--color-ink)] px-3 py-2 text-[12px] font-bold text-white transition active:scale-95"
            >
              Sign out
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-xl px-3 py-2 text-[12px] font-bold text-[var(--color-ink)]/60 transition active:bg-black/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Always shown — what it says depends on whether, and how, this browser installs. */
function InstallRow() {
  const state = useInstallState();
  // A tap that found the offer already spent falls back to the manual route.
  const [offerGone, setOfferGone] = useState(false);
  const route =
    offerGone && state.deferred === null ? 'browser-menu' : installRoute(state);

  const install = async () => {
    if (!(await promptInstall())) setOfferGone(true);
  };

  const detail: Record<typeof route, ReactNode> = {
    installed: "You're using the app.",
    native: 'Keep Recommend on your home screen.',
    'ios-safari': (
      <>
        Tap <ShareGlyph /> below, then <b>Add to Home Screen</b>.
      </>
    ),
    'ios-other': (
      <>
        Open this page in <b>Safari</b>, then tap <ShareGlyph /> and{' '}
        <b>Add to Home Screen</b>.
      </>
    ),
    'browser-menu': (
      <>
        Open your browser&apos;s menu (<b>⋮</b>), then tap <b>Install app</b> or{' '}
        <b>Add to Home screen</b>.
      </>
    ),
  };

  return (
    <Row
      icon={<DownloadIcon />}
      tone="orange"
      title={route === 'installed' ? 'App installed' : 'Install app'}
      detail={detail[route]}
      action={
        route === 'native' ? (
          <ActionButton tone="orange" onClick={() => void install()}>
            Install
          </ActionButton>
        ) : route === 'installed' ? (
          <Done />
        ) : null
      }
    />
  );
}

type AlertsState =
  | 'checking'
  | 'install-first'
  | 'off'
  | 'asking'
  | 'on'
  | 'blocked'
  | 'unavailable';

function AlertsRow() {
  const [state, setState] = useState<AlertsState>('checking');

  useEffect(() => {
    // Web push reaches an iPhone only once the app is on the Home Screen.
    if (isIosSafari() && !isInstalled()) {
      setState('install-first');
      return;
    }
    let cancelled = false;
    void currentPushState().then((push) => {
      if (cancelled) return;
      setState(
        push === 'granted'
          ? 'on'
          : push === 'available'
            ? 'off'
            : push === 'denied'
              ? 'blocked'
              : 'unavailable',
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = async () => {
    setState('asking');
    const result = await enableOrderAlerts((body) =>
      chatClient.registerPush(body),
    );
    setState(
      result === 'on'
        ? 'on'
        : result === 'failed'
          ? 'off'
          : result === 'denied'
            ? 'blocked'
            : 'unavailable',
    );
  };

  const detail: Record<AlertsState, ReactNode> = {
    checking: '…',
    'install-first':
      'On iPhone, install the app first (above), then turn these on.',
    off: "We'll tell you when your order is ready or on its way.",
    asking: "We'll tell you when your order is ready or on its way.",
    on: "We'll tell you when your order is ready or on its way.",
    blocked:
      'Notifications are blocked for this site. Allow them in your browser settings, then come back here.',
    unavailable: "This browser can't show order alerts.",
  };

  return (
    <Row
      icon={<BellIcon />}
      tone="brand"
      title="Order alerts"
      detail={detail[state]}
      action={
        state === 'on' ? (
          <Done label="On" />
        ) : state === 'off' || state === 'asking' ? (
          <ActionButton
            tone="brand"
            disabled={state === 'asking'}
            onClick={() => void turnOn()}
          >
            {state === 'asking' ? '…' : 'Turn on'}
          </ActionButton>
        ) : null
      }
    />
  );
}

// ─── Building blocks ───────────────────────────────────────────────────────────────

const TONES = {
  orange: 'bg-[var(--color-orange)]/10 text-[var(--color-orange)]',
  brand: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
  muted: 'bg-black/5 text-[var(--color-ink)]/60',
} as const;

function Row({
  icon,
  tone,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: string;
  detail: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-hairline)] px-3.5 py-3">
      <Badge tone={tone}>{icon}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-[var(--color-ink)]">{title}</p>
        <p className="text-[12px] leading-snug text-[var(--color-ink)]/55">
          {detail}
        </p>
      </div>
      {action}
    </div>
  );
}

function LinkRow({
  href,
  icon,
  title,
  detail,
  external,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition active:bg-black/5"
    >
      <Badge tone="muted">{icon}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-[var(--color-ink)]">{title}</p>
        <p className="truncate text-[12px] text-[var(--color-ink)]/55">
          {detail}
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-ink)]/30"
        />
      </svg>
    </a>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

function ActionButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: 'orange' | 'brand';
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const bg =
    tone === 'orange' ? 'bg-[var(--color-orange)]' : 'bg-[var(--color-brand)]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-xl ${bg} px-3 py-2 text-[12px] font-bold text-white transition active:scale-95 disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function Done({ label }: { label?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand)]/10 px-2.5 py-1 text-[12px] font-bold text-[var(--color-brand)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────────

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function PersonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.6" {...stroke} />
      <path d="M4.8 19.5a7.2 7.2 0 0114.4 0" {...stroke} />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 14v2A1.5 1.5 0 0 0 5 17.5h10a1.5 1.5 0 0 0 1.5-1.5v-2"
        {...stroke}
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a6 6 0 016 6v3.6l1.4 2.6a.8.8 0 01-.7 1.2H5.3a.8.8 0 01-.7-1.2L6 12.6V9a6 6 0 016-6z"
        {...stroke}
      />
      <path d="M9.8 19a2.3 2.3 0 004.4 0" {...stroke} />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3l1.5 4-2 1.2a11 11 0 005.3 5.3l1.2-2 4 1.5v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"
        {...stroke}
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" {...stroke} />
      <path d="M4 7l8 6 8-6" {...stroke} />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2" {...stroke} />
      <path d="M12 17h.01" {...stroke} strokeWidth={2.6} />
    </svg>
  );
}
