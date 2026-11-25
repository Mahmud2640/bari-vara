import React from 'react';
import { View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react-native';
import { color, space } from '../design/tokens';
import { EmptyState } from './Chrome';
import { SkeletonCard } from './Skeleton';
import { useT } from '../lib/lang';

// loading -> skeletons (not a spinner), error -> a message with retry, otherwise the content.
export function Async<T>({
  query, skeleton, children,
}: { query: UseQueryResult<T>; skeleton?: React.ReactNode; children: (data: T) => React.ReactNode }) {
  const t = useT();
  if (query.isPending) {
    return <View style={{ gap: space[3] }}>{skeleton ?? (<><SkeletonCard /><SkeletonCard /></>)}</View>;
  }
  if (query.isError) {
    return (
      <EmptyState
        icon={<CircleAlert size={32} color={color.danger} />}
        title={t('common.error')}
        body={t('common.errorBody')}
        actionLabel={t('common.retry')}
        onAction={() => query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}
