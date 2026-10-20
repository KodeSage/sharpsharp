import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Compass className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
          This page wandered off
        </h1>
        <p className="mt-3 text-ink/60">
          We couldn't find what you're looking for. Let's get you back.
        </p>
        <Link
          to="/"
          className="tap-target mt-8 inline-flex items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-white transition hover:bg-primary-dark"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
