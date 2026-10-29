import { useEffect, useState } from 'react';

// true while the browser window matches a CSS media query, e.g. useMediaQuery('(max-width: 767.98px)')
export function useMediaQuery(query) {
  const read = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => (mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange));
  }, [query]);

  return matches;
}
