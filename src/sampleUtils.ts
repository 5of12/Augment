const FALLBACK_SAMPLE_NOTES = ['C3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5'] as const;

const NOTE_NAME_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

const SAMPLE_NOTE_PATTERN = /([A-Ga-g])([#b♯♭s]?)(-?\d)/;

const clampMidi = (midi: number) => Math.max(0, Math.min(127, midi));

export const midiToScientificPitch = (midi: number) => {
  const safeMidi = clampMidi(Math.round(midi));
  const semitone = ((safeMidi % 12) + 12) % 12;
  const octave = Math.floor(safeMidi / 12) - 1;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${noteNames[semitone]}${octave}`;
};

export const scientificPitchToMidi = (note: string) => {
  const match = note.trim().match(/^([A-G])([#b]?)(-?\d)$/);
  if (!match) return null;

  const [, letter, accidental, octaveText] = match;
  let semitone = NOTE_NAME_TO_SEMITONE[letter];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;

  return clampMidi((Number(octaveText) + 1) * 12 + semitone);
};

export const normalizeSampleNote = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{1,3}$/.test(trimmed)) {
    return midiToScientificPitch(Number(trimmed));
  }

  const basename = trimmed.replace(/\.[^.]+$/, '');
  const normalized = basename.replace(/♯/g, '#').replace(/♭/g, 'b');
  const match = normalized.match(SAMPLE_NOTE_PATTERN);
  if (!match) return null;

  const [, letter, accidentalRaw, octaveText] = match;
  const accidental = accidentalRaw === 's' ? '#' : accidentalRaw;
  const midi = scientificPitchToMidi(`${letter.toUpperCase()}${accidental}${octaveText}`);
  return midi === null ? null : midiToScientificPitch(midi);
};

export const inferSampleNoteFromFilename = (filename: string, fallbackIndex = 0) => {
  const basename = filename.replace(/\.[^.]+$/, '');
  const segments = basename.split(/[\s._-]+/).filter(Boolean);

  for (const segment of [basename, ...segments]) {
    const note = normalizeSampleNote(segment);
    if (note) return note;
  }

  return FALLBACK_SAMPLE_NOTES[fallbackIndex % FALLBACK_SAMPLE_NOTES.length];
};

export const sortSampleNotes = (notes: string[]) =>
  [...notes].sort((left, right) => {
    const leftMidi = scientificPitchToMidi(left);
    const rightMidi = scientificPitchToMidi(right);

    if (leftMidi === null && rightMidi === null) return left.localeCompare(right);
    if (leftMidi === null) return 1;
    if (rightMidi === null) return -1;
    return leftMidi - rightMidi;
  });
