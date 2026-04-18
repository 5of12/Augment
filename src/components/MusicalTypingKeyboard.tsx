import React from 'react';
import { Cable, Piano } from 'lucide-react';
import {
  MUSICAL_TYPING_NOTES,
  MUSICAL_TYPING_WHITE_KEY_COUNT,
  MusicalTypingNote
} from '../musicalTyping';

interface MusicalTypingKeyboardProps {
  activeNotes: number[];
  midiSupported: boolean;
  midiEnabled: boolean;
  midiInputNames: string[];
  midiError: string | null;
  onEnableMidi: () => void;
  onNoteAttack: (midi: number, sourceId: string, velocity?: number) => void;
  onNoteRelease: (midi: number, sourceId: string) => void;
}

const whiteKeyWidth = 100 / MUSICAL_TYPING_WHITE_KEY_COUNT;
const blackKeyWidth = whiteKeyWidth * 0.62;

const getBlackKeyLeft = (note: MusicalTypingNote) => {
  const boundary = (note.whiteIndex + 1) * whiteKeyWidth;
  return boundary - blackKeyWidth / 2;
};

const getMidiStatus = (midiSupported: boolean, midiEnabled: boolean, midiInputNames: string[]) => {
  if (!midiSupported) return 'Web MIDI unavailable';
  if (!midiEnabled) return 'MIDI off';
  if (midiInputNames.length === 0) return 'Listening';
  return `${midiInputNames.length} input${midiInputNames.length > 1 ? 's' : ''}`;
};

export const MusicalTypingKeyboard: React.FC<MusicalTypingKeyboardProps> = ({
  activeNotes,
  midiSupported,
  midiEnabled,
  midiInputNames,
  midiError,
  onEnableMidi,
  onNoteAttack,
  onNoteRelease
}) => {
  const activeNoteSet = new Set(activeNotes);
  const whiteKeys = MUSICAL_TYPING_NOTES.filter((note) => !note.isBlack);
  const blackKeys = MUSICAL_TYPING_NOTES.filter((note) => note.isBlack);
  const midiStatus = getMidiStatus(midiSupported, midiEnabled, midiInputNames);

  const attachPointerHandlers = (note: MusicalTypingNote) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onNoteAttack(note.midi, `pointer:${note.midi}`, 0.88);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      onNoteRelease(note.midi, `pointer:${note.midi}`);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: () => onNoteRelease(note.midi, `pointer:${note.midi}`),
    onLostPointerCapture: () => onNoteRelease(note.midi, `pointer:${note.midi}`),
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()
  });

  return (
    <div id="musical-typing-panel" className="musical-typing-panel flex flex-col gap-3">
      <div id="musical-typing-toolbar" className="musical-typing-toolbar flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d7a73]">
            <Piano size={12} />
            <span>Musical Typing</span>
          </div>
          <span
            id="musical-typing-layout-badge"
            className="rounded-full border border-[#d7d4cb] bg-[#f5f3ed] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6c6861]"
          >
            Z-M / Q-P
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            id="midi-status-badge"
            className="inline-flex items-center gap-2 rounded-full border border-[#d7d4cb] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6c6861]"
          >
            <Cable size={11} />
            <span>{midiStatus}</span>
          </div>
          {midiSupported && (
            <button
              id="enable-midi-button"
              type="button"
              onClick={onEnableMidi}
              aria-label={midiEnabled ? 'Refresh MIDI inputs' : 'Enable MIDI input'}
              className="rounded-full border border-[#d0d0cb] bg-[#f6f5f0] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#222] transition-colors hover:bg-[#eceae2]"
            >
              {midiEnabled ? 'Refresh MIDI' : 'Enable MIDI'}
            </button>
          )}
        </div>
      </div>

      {(midiError || (midiEnabled && midiInputNames.length > 0)) && (
        <div id="midi-device-row" className="midi-device-row min-h-[1rem] text-[11px] text-[#7a7973]">
          {midiError ? (
            <span className="text-[#a04c2c]">{midiError}</span>
          ) : (
            <span>{midiInputNames.join(' · ')}</span>
          )}
        </div>
      )}

      <div
        id="musical-keyboard-surface"
        className="musical-keyboard-surface rounded-[1.5rem] border border-[#d9d6ce] bg-[#efede7] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
      >
        <div
          id="musical-keyboard"
          className="musical-keyboard relative h-36 overflow-hidden rounded-[1.1rem] border border-[#d4d1c8] bg-[#f8f6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:h-40"
        >
          <div className="absolute inset-0 flex">
            {whiteKeys.map((note) => {
              const isActive = activeNoteSet.has(note.midi);
              return (
                <button
                  key={note.midi}
                  id={`musical-key-${note.midi}`}
                  type="button"
                  aria-label={`Play ${note.note} with ${note.key.toUpperCase()}`}
                  {...attachPointerHandlers(note)}
                  className={`musical-key musical-key-white relative flex-1 border-r border-[#d8d5cd] transition-colors last:border-r-0 ${
                    isActive ? 'bg-[#fff2eb]' : 'bg-[#fcfbf7]'
                  }`}
                >
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.05),transparent)]" />
                  <div className="absolute left-2.5 top-2.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#b0aea8]">
                    {note.key}
                  </div>
                  <div className={`absolute bottom-3 left-2.5 text-[11px] font-medium ${isActive ? 'text-[#ff4a00]' : 'text-[#3e3d39]'}`}>
                    {note.note}
                  </div>
                </button>
              );
            })}
          </div>

          {blackKeys.map((note) => {
            const isActive = activeNoteSet.has(note.midi);
            return (
              <button
                key={note.midi}
                id={`musical-key-${note.midi}`}
                type="button"
                aria-label={`Play ${note.note} sharp with ${note.key.toUpperCase()}`}
                {...attachPointerHandlers(note)}
                className={`musical-key musical-key-black absolute top-0 z-10 h-[56%] rounded-b-[0.9rem] border border-[#1f1f1f] shadow-[0_8px_14px_rgba(0,0,0,0.22)] transition-colors ${
                  isActive ? 'bg-[#2e2a27]' : 'bg-[#111]'
                }`}
                style={{ left: `${getBlackKeyLeft(note)}%`, width: `${blackKeyWidth}%` }}
              >
                <div className={`absolute inset-x-0 top-2.5 text-center text-[9px] font-bold uppercase tracking-[0.18em] ${isActive ? 'text-[#ffb18c]' : 'text-[#8d8b84]'}`}>
                  {note.key}
                </div>
                <div className={`absolute inset-x-0 bottom-2.5 text-center text-[10px] font-medium ${isActive ? 'text-white' : 'text-[#d8d6cf]'}`}>
                  {note.note}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
