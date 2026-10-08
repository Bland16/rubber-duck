// covers: object and array literals across lines
const defaults = {
  theme: 'light',
  fontSize: 14,
  shortcuts: {
    save: ['Ctrl', 'S'],
    find: ['Ctrl', 'F'],
  },
  recentFiles: [],
};

const palettes = [
  { name: 'pond', colors: ['#2a6f97', '#61a5c2', '#a9d6e5'] },
  { name: 'sunset', colors: ['#ff7b00', '#ff9500', '#ffb700'] },
  {
    name: 'mono',
    colors: [
      '#111111',
      '#777777',
      '#eeeeee',
    ],
  },
];

function applySettings(overrides) {
  const settings = Object.assign({}, defaults, overrides);
  const palette = palettes.find(function (p) {
    return p.name === settings.palette;
  });
  settings.colors = palette ? palette.colors : palettes[0].colors;
  return settings;
}

console.log(applySettings({ palette: 'mono', fontSize: 16 }));
