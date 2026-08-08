import { useState } from 'react';

/**
 * A product's picture, or a stand-in.
 *
 * Buyers want to see what they are buying before paying — the reason Chowdeck and Glovo
 * lead with photographs. The slot is always rendered, even when a vendor has not uploaded
 * anything, so rows keep a consistent height and the list does not jump around as images
 * arrive. A broken URL falls back to the same stand-in rather than a torn-image icon.
 */
export function ProductThumb({
  src,
  name,
  size = 64,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

  return (
    <div
      className="shrink-0 overflow-hidden rounded-xl bg-[var(--color-cream-deep)]"
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center text-[var(--color-orange)]/45"
          aria-hidden
        >
          <svg
            width={size * 0.4}
            height={size * 0.4}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 11.5 4.2-5 3 3.6 2.3-2.7L19 17H5z" />
            <circle cx="8.5" cy="9" r="1.4" />
          </svg>
        </span>
      )}
    </div>
  );
}
