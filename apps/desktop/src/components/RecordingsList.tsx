import type { RecordingMetadata } from "../types/recording";

export type RecordingsListProps = {
  recordings: RecordingMetadata[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function RecordingsList({ recordings, selectedId, onSelect }: RecordingsListProps) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-sm font-semibold">Recordings</div>

      <div className="mt-3 space-y-2">
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.currentTarget.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          <option value="">None</option>
          {recordings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title ? `${r.title} (${r.id})` : r.id}
            </option>
          ))}
        </select>

        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Total: {recordings.length}
        </div>
      </div>
    </section>
  );
}
