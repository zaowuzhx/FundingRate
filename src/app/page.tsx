import { redirect } from 'next/navigation';

// Redirect root to the locale-aware arbitrage page to ensure locale/config initialization
export default function Page() {
  // default to Chinese locale route
  redirect('/zh/arbitrage');
}


