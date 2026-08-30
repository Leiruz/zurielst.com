'use client';

import { useEffect, useState } from 'react';

import { greetingForHour } from '@/lib/dossier';

export function LocalGreeting() {
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return <span data-local-greeting="true">{greeting}</span>;
}
