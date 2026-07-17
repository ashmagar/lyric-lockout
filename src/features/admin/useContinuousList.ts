import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const ADMIN_INITIAL_BATCH_SIZE = 40;
export const ADMIN_ADDITIONAL_BATCH_SIZE = 30;

export function useContinuousList<T>(items: readonly T[], resetKey: string) {
  const [renderedCount, setRenderedCount] = useState(ADMIN_INITIAL_BATCH_SIZE);
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);

  useEffect(() => {
    setRenderedCount(ADMIN_INITIAL_BATCH_SIZE);
  }, [resetKey]);

  const loadMore = useCallback(() => {
    setRenderedCount((current) => Math.min(items.length, current + ADMIN_ADDITIONAL_BATCH_SIZE));
  }, [items.length]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!node || renderedCount >= items.length || !('IntersectionObserver' in window)) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      });
      observerRef.current.observe(node);
    },
    [items.length, loadMore, renderedCount],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    visibleItems: useMemo(() => items.slice(0, renderedCount), [items, renderedCount]),
    renderedCount,
    hasMore: renderedCount < items.length,
    loadMore,
    sentinelRef,
  };
}
