"use client";

export default function BoardError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h2 className="mb-2 text-lg font-semibold text-danger">Board error</h2>
      <pre className="overflow-auto rounded-lg bg-surface-2 p-4 text-xs text-muted">{error.message}</pre>
      <pre className="mt-2 overflow-auto rounded-lg bg-surface-2 p-4 text-[10px] text-muted-2">{error.stack}</pre>
    </div>
  );
}
