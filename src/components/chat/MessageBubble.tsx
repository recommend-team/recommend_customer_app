import type { ChatMessage } from '../../lib/contract';
import { QuickReplies } from './QuickReplies';
import { ProductListCard } from './cards/ProductListCard';
import { VendorListCard } from './cards/VendorListCard';
import { OrderSummaryCard } from './cards/OrderSummaryCard';
import { PaymentLinkCard } from './cards/PaymentLinkCard';

/**
 * One turn in the thread.
 *
 * Buyer turns are orange and right-aligned, the assistant's are white and left-aligned,
 * each with a small tail — straight from the design reference.
 *
 * Payloads render beneath the bubble that carried them, because they belong to what was
 * said: the chips answer the question just asked, and the payment card belongs to the
 * turn that quoted the price.
 */
export function MessageBubble({
  message,
  live,
  paidReferences,
  onChoose,
  onOpenVendor,
  onPaid,
}: {
  message: ChatMessage;
  live: boolean;
  paidReferences: Set<string>;
  onChoose: (label: string) => void;
  onOpenVendor: (slug: string, name: string | null) => void;
  onPaid: (reference: string) => void;
}) {
  const isBuyer = message.author === 'BUYER';
  const payload = message.payload;

  return (
    <div className={`flex flex-col ${isBuyer ? 'items-end' : 'items-start'}`}>
      <div
        className={[
          'bubble-tail relative max-w-[82%] px-3.5 py-2.5 shadow-sm',
          isBuyer
            ? 'bubble-tail-right rounded-2xl rounded-tr-md bg-[var(--color-orange)] text-white'
            : 'bubble-tail-left rounded-2xl rounded-tl-md bg-white text-[var(--color-ink)]',
        ].join(' ')}
      >
        <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
          {message.text}
        </p>

        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            isBuyer ? 'text-white/70' : 'text-[var(--color-muted)]'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isBuyer && (
            <DeliveredTicks pending={message.id.startsWith('local-')} />
          )}
        </div>
      </div>

      {payload?.kind === 'choices' && (
        <QuickReplies data={payload.data} onChoose={onChoose} />
      )}

      {payload?.kind === 'product_list' && (
        <ProductListCard data={payload.data} onOpenVendor={onOpenVendor} />
      )}

      {payload?.kind === 'vendor_list' && (
        <VendorListCard data={payload.data} onOpenVendor={onOpenVendor} />
      )}

      {payload?.kind === 'order_summary' && (
        <OrderSummaryCard
          data={payload.data}
          actionable={live}
          onConfirm={() => onChoose('yes')}
          onCancel={() => onChoose('no')}
        />
      )}

      {payload?.kind === 'payment_link' && (
        <PaymentLinkCard
          data={payload.data}
          active={live}
          settled={paidReferences.has(payload.data.reference)}
          onPaid={onPaid}
        />
      )}
    </div>
  );
}

/** Single tick until the server has it, double once it does — as in the reference. */
function DeliveredTicks({ pending }: { pending: boolean }) {
  return (
    <svg width="14" height="10" viewBox="0 0 16 11" fill="none" aria-hidden>
      <path
        d="M1 6.2 3.4 8.6 8.6 3.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!pending && (
        <path
          d="M6.8 6.2 9.2 8.6 14.4 3.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
}
