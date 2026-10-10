import { useState, useEffect, useCallback } from 'preact/hooks';

const TAB_PATHS = {
  today: '/',
  planned: '/planned',
  chores: '/chores',
  motivation: '/motivation',
  history: '/history',
};

function tabFromPath(path) {
  const clean = path.replace(/\/+$/, '') || '/';
  return Object.keys(TAB_PATHS).find((k) => TAB_PATHS[k] === clean) || 'today';
}

export function useTabRoute() {
  const [tab, setTabState] = useState(() => tabFromPath(location.pathname));
  useEffect(() => {
    const onPop = () => setTabState(tabFromPath(location.pathname));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const setTab = useCallback((next) => {
    if (location.pathname !== TAB_PATHS[next]) history.pushState(null, '', TAB_PATHS[next]);
    setTabState(next);
    scrollTo(0, 0);
  }, []);
  return [tab, setTab];
}
