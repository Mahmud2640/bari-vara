import React from 'react';
import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { data } from '../data';

export default function Index() {
  const session = useQuery({ queryKey: ['session'], queryFn: () => data.getSession() });
  if (session.isPending) return null;
  return <Redirect href={session.data ? '/home' : '/welcome'} />;
}
