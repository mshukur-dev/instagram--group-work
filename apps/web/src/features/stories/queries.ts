import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getStoriesFeed } from './api';

export const useStoriesFeed = () =>
  useQuery({ queryKey: queryKeys.storiesFeed(), queryFn: getStoriesFeed });
