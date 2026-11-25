import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { data, Property } from '../data';

const KEY = 'rentbook.activeProperty';

interface Ctx {
  property: Property | null;
  properties: Property[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  setActive: (id: string) => void;
}

const ActiveCtx = createContext<Ctx>({
  property: null, properties: [], isLoading: true, isError: false, refetch: () => {}, setActive: () => {},
});

// "Which property am I looking at": the one the user picked last, else the primary one, else the first.
export function ActivePropertyProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const props = useQuery({ queryKey: ['properties'], queryFn: () => data.listProperties() });
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => data.getProfile() });

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setActiveId(v)).catch(() => {});
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    AsyncStorage.setItem(KEY, id).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const list = props.data ?? [];
    const property =
      list.find((p) => p.id === activeId) ??
      list.find((p) => p.id === profile.data?.primaryPropertyId) ??
      list[0] ??
      null;
    return {
      property,
      properties: list,
      isLoading: props.isLoading || profile.isLoading,
      isError: props.isError || profile.isError,
      refetch: () => { props.refetch(); profile.refetch(); },
      setActive,
    };
  }, [props.data, props.isLoading, props.isError, profile.data, profile.isLoading, profile.isError, activeId, setActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return <ActiveCtx.Provider value={value}>{children}</ActiveCtx.Provider>;
}

export function useActiveProperty(): Ctx {
  return useContext(ActiveCtx);
}
