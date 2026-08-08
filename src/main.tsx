import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { config } from './lib/config';
import { App } from './App';
import './index.css';

// Optional by design — a missing DSN skips tracking rather than breaking the app.
if (config.sentryDsn) {
  Sentry.init({ dsn: config.sentryDsn, tracesSampleRate: 0.1 });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Buyers are on patchy mobile networks; a brief cache beats a spinner.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
