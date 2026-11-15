import {useCallback, useState} from 'react';

import {messageOf} from './errors';
import {findDump} from './library';
import {useProgress} from './progress';
import {navigate} from './router';
import {createSession} from './sessions';
import type {PracticeMode} from './types';
import {useSettings} from './useSettings';

export interface StartDumpApi {
  start: (id: string, mode?: PracticeMode, count?: number) => Promise<void>;
  busyId: string | null;
  error: string | null;
  clearError: () => void;
}

/** Loads a dump (downloading it if needed) and opens a session. */
export function useStartDump(): StartDumpApi {
  const {map} = useProgress();
  const [settings] = useSettings();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (id: string, mode: PracticeMode = 'mixed', count?: number) => {
      setBusyId(id);
      setError(null);
      try {
        const found = await findDump(id);
        if (!found) throw new Error('That dump could not be found. Import it again or refresh.');
        const session = await createSession(found.dump, map, mode, count ?? settings.count);
        navigate(`/practice/${session.id}`);
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusyId(null);
      }
    },
    [map, settings.count],
  );

  return {start, busyId, error, clearError: () => setError(null)};
}
