export interface MusicalTypingNote {
  key: string;
  midi: number;
  note: string;
  isBlack: boolean;
  whiteIndex: number;
}

const KEY_TO_MIDI: Array<{ key: string; midi: number }> = [
  { key: 'z', midi: 48 },
  { key: 's', midi: 49 },
  { key: 'x', midi: 50 },
  { key: 'd', midi: 51 },
  { key: 'c', midi: 52 },
  { key: 'v', midi: 53 },
  { key: 'g', midi: 54 },
  { key: 'b', midi: 55 },
  { key: 'h', midi: 56 },
  { key: 'n', midi: 57 },
  { key: 'j', midi: 58 },
  { key: 'm', midi: 59 },
  { key: 'q', midi: 60 },
  { key: '2', midi: 61 },
  { key: 'w', midi: 62 },
  { key: '3', midi: 63 },
  { key: 'e', midi: 64 },
  { key: 'r', midi: 65 },
  { key: '5', midi: 66 },
  { key: 't', midi: 67 },
  { key: '6', midi: 68 },
  { key: 'y', midi: 69 },
  { key: '7', midi: 70 },
  { key: 'u', midi: 71 },
  { key: 'i', midi: 72 },
  { key: '9', midi: 73 },
  { key: 'o', midi: 74 },
  { key: '0', midi: 75 },
  { key: 'p', midi: 76 }
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEY_STEPS = new Set([1, 3, 6, 8, 10]);

const getNoteName = (midi: number) => {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
};

let whiteIndex = 0;

export const MUSICAL_TYPING_NOTES: MusicalTypingNote[] = KEY_TO_MIDI.map(({ key, midi }) => {
  const isBlack = BLACK_KEY_STEPS.has(midi % 12);
  const note = getNoteName(midi);
  const mappedNote = { key, midi, note, isBlack, whiteIndex };

  if (!isBlack) whiteIndex += 1;
  return mappedNote;
});

export const MUSICAL_TYPING_KEYMAP: Record<string, MusicalTypingNote> = Object.fromEntries(
  MUSICAL_TYPING_NOTES.map((note) => [note.key, note])
);

export const MUSICAL_TYPING_WHITE_KEY_COUNT = MUSICAL_TYPING_NOTES.filter((note) => !note.isBlack).length;
