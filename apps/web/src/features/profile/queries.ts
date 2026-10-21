import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getMe } from './api';

export const useMe = () => useQuery({ queryKey: queryKeys.me(), queryFn: getMe });
