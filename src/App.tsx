import {useEffect, useMemo, useRef, useState} from 'react';
import {useConnected, useSession} from '@mentra/miniapp/react';

const STORAGE_KEY = 'transcript-history-v1';
const MAX_HISTORY = 100;

interface Transcript {
  id: string;
  utteranceId: string | null;
  speaker: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

type CaptionsTranscriptionData = TranscriptionData & {
  utteranceId?: string;
  speakerId?: string;
};

interface TranscriptionData {
  text: string;
  isFinal: boolean;
  language?: string;
  startTime?: number;
  endTime?: number;
}

function speakerLabel(speakerId?: string) {
  return speakerId ? `Speaker ${speakerId}` : 'Speaker 1';
}

function makeId(data: CaptionsTranscriptionData) {
  return data.utteranceId || `transcript-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(epochMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(epochMs));
}

function getDisplayText(finalHistory: Transcript[], liveTranscript: Transcript | null) {
  const recentFinals = finalHistory.slice(-2).map((item) => item.text);
  const lines = liveTranscript?.text ? [...recentFinals, liveTranscript.text] : recentFinals;
  return lines.join('\n').trim();
}

export default function App() {
  const session = useSession();
  const connected = useConnected();
  const [history, setHistory] = useState<Transcript[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<Transcript | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const historyRef = useRef<Transcript[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const stored = await session.storage.get(STORAGE_KEY);
        if (cancelled) return;
        const parsed = stored ? JSON.parse(stored) : [];
        setHistory(Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : []);
        setLoadState('ready');
      } catch (error) {
        console.warn('Failed to load transcript history', error);
        if (!cancelled) setLoadState('error');
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const unsubscribe = session.transcription.on((rawData) => {
      const data = rawData as CaptionsTranscriptionData;
      const text = data.text.trim();
      if (!text) return;

      const entry: Transcript = {
        id: makeId(data),
        utteranceId: data.utteranceId || null,
        speaker: speakerLabel(data.speakerId),
        text,
        timestamp: Date.now(),
        isFinal: data.isFinal,
      };

      if (data.isFinal) {
        setLiveTranscript((current) => (current?.utteranceId === entry.utteranceId ? null : current));
        setHistory((current) => {
          const withoutMatch = entry.utteranceId
            ? current.filter((item) => item.utteranceId !== entry.utteranceId)
            : current;
          const next = [...withoutMatch, entry].slice(-MAX_HISTORY);
          historyRef.current = next;
          session.storage.set(STORAGE_KEY, JSON.stringify(next)).catch((error) => {
            console.warn('Failed to persist transcript history', error);
          });
          session.display.showTextWall(getDisplayText(next, null));
          return next;
        });
        return;
      }

      setLiveTranscript(entry);
      session.display.showTextWall(getDisplayText(historyRef.current, entry));
    });

    return unsubscribe;
  }, [session]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [history, liveTranscript]);

  const displayItems = useMemo(() => {
    return liveTranscript ? [...history, liveTranscript] : history;
  }, [history, liveTranscript]);

  const clearHistory = () => {
    setHistory([]);
    setLiveTranscript(null);
    historyRef.current = [];
    session.storage.delete(STORAGE_KEY).catch((error) => {
      console.warn('Failed to delete transcript history', error);
    });
    session.display.clearView();
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Live Captions</h1>
          <p style={styles.subtitle}>
            {connected ? 'Listening for speech' : 'Connecting to MentraOS'}
          </p>
        </div>
        <span style={{...styles.statusDot, background: connected ? '#17a34a' : '#d04437'}} />
      </header>

      <section style={styles.livePanel}>
        <span style={styles.kicker}>{liveTranscript ? 'Live' : 'Latest'}</span>
        <p style={styles.liveText}>
          {liveTranscript?.text || history.at(-1)?.text || 'Start speaking to see captions.'}
        </p>
      </section>

      <div style={styles.toolbar}>
        <span style={styles.count}>
          {history.length} saved caption{history.length === 1 ? '' : 's'}
        </span>
        <button type="button" onClick={clearHistory} style={styles.button}>
          Clear
        </button>
      </div>

      <section ref={scrollRef} style={styles.history}>
        {displayItems.length === 0 ? (
          <p style={styles.empty}>
            {loadState === 'loading'
              ? 'Loading saved captions...'
              : loadState === 'error'
                ? 'Could not load saved captions.'
                : 'Final captions will be saved here.'}
          </p>
        ) : (
          displayItems.map((item) => (
            <article
              key={item.id}
              style={{
                ...styles.card,
                opacity: item.isFinal ? 1 : 0.72,
                borderLeftColor: item.isFinal ? '#2f7d75' : '#d29a2e',
              }}>
              <div style={styles.cardMeta}>
                <strong>{item.speaker}</strong>
                <span>{item.isFinal ? formatTime(item.timestamp) : 'Now'}</span>
              </div>
              <p style={{...styles.cardText, fontStyle: item.isFinal ? 'normal' : 'italic'}}>
                {item.text}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    boxSizing: 'border-box',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '18px 18px 20px',
    background: '#f4f7f6',
    color: '#17211f',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 700,
  },
  subtitle: {
    margin: '3px 0 0',
    color: '#65716e',
    fontSize: 13,
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: '50%',
    boxShadow: '0 0 0 4px rgba(23, 163, 74, 0.12)',
    flex: '0 0 auto',
  },
  livePanel: {
    border: '1px solid #d7e2df',
    borderRadius: 8,
    background: '#ffffff',
    padding: 16,
  },
  kicker: {
    display: 'block',
    marginBottom: 7,
    color: '#2f7d75',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  liveText: {
    margin: 0,
    fontSize: 21,
    lineHeight: 1.32,
    fontWeight: 400,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  count: {
    color: '#65716e',
    fontSize: 13,
  },
  button: {
    border: '1px solid #c9d7d3',
    borderRadius: 8,
    background: '#fff',
    color: '#17211f',
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 650,
  },
  history: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 2,
  },
  empty: {
    margin: '42px auto 0',
    maxWidth: 260,
    textAlign: 'center',
    color: '#65716e',
    fontSize: 14,
    lineHeight: 1.45,
  },
  card: {
    border: '1px solid #dce6e3',
    borderLeft: '4px solid #2f7d75',
    borderRadius: 8,
    background: '#fff',
    padding: '11px 12px',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    color: '#65716e',
    fontSize: 12,
  },
  cardText: {
    margin: '7px 0 0',
    fontSize: 16,
    lineHeight: 1.42,
  },
} satisfies Record<string, React.CSSProperties>;
