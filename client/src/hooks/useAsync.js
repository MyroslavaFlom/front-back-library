import { useCallback, useEffect, useState } from 'react';

// Завантажує дані асинхронною функцією; перезапускається при зміні deps і через reload().
// reload() оновлює дані «тихо»: попередні дані лишаються на екрані до відповіді.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState((s) => ({ ...s, error, loading: false })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
