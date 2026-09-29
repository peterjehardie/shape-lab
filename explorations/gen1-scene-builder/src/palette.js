// Palettes in the Chroma Mat style: six colour roles in OKLCH (lightness, chroma, hue),
// each with a target share of the picture and a five-step ramp from shadow to light.
// The library data came across from Chroma Mat, the ancestor of this project.
import { clamp } from './util.js';
import { labToRgb, rgbCss, hexToLab } from './color.js';

export const ROLES = ['ground', 'dominant', 'secondary', 'accent', 'dark', 'light'];
export const RNAME = { ground: 'Ground', dominant: 'Dominant', secondary: 'Secondary', accent: 'Accent', dark: 'Dark', light: 'Light' };
export const STEPS = [-0.26, -0.13, 0, 0.09, 0.17];

export function mixHue(a, b, t) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}
function mkPal(name, cat, note, g, d, s, a, k, l, lt, sh, props) {
  return {
    name, cat, note,
    roles: { ground: g, dominant: d, secondary: s, accent: a, dark: k, light: l },
    light: { h: lt[0], amt: lt[1] }, shadow: { h: sh[0], amt: sh[1] },
    props: props || { ground: 0.42, dominant: 0.26, secondary: 0.14, accent: 0.04, dark: 0.1, light: 0.04 },
  };
}
export const PALETTES=[
 mkPal('Nordic overcast','Landscape light','Flat grey sky, cool water, dark spruce, one warm painted wall.',[.86,.012,230],[.52,.03,205],[.40,.045,155],[.60,.13,40],[.24,.02,245],[.95,.006,220],[220,.2],[250,.3]),
 mkPal('Golden hour','Landscape light','Low warm sun; long violet shadows.',[.88,.06,85],[.68,.12,68],[.48,.07,120],[.62,.18,35],[.30,.06,300],[.96,.08,92],[72,.55],[295,.5]),
 mkPal('Blue hour','Landscape light','After sunset: blue ambient, the only warmth from lit windows.',[.42,.06,265],[.32,.07,270],[.50,.05,300],[.84,.14,80],[.17,.03,270],[.70,.05,250],[255,.3],[275,.3],{ground:.45,dominant:.28,secondary:.12,accent:.03,dark:.1,light:.02}),
 mkPal('Desert noon','Landscape light','High sun, bleached ground, short blue shade.',[.93,.03,85],[.75,.09,62],[.62,.11,45],[.56,.12,235],[.42,.07,32],[.98,.02,90],[88,.2],[255,.45]),
 mkPal('Fog','Landscape light','Everything pushed toward the light; tiny value range.',[.90,.008,200],[.80,.012,190],[.69,.016,170],[.52,.035,150],[.46,.02,200],[.96,.004,200],[200,.05],[210,.1],{ground:.5,dominant:.24,secondary:.14,accent:.03,dark:.05,light:.04}),
 mkPal('Winter, low sun','Landscape light','Snow lit gold, snow shadow blue, conifers near black.',[.95,.012,240],[.84,.035,252],[.35,.035,160],[.74,.11,62],[.22,.03,260],[.99,.012,90],[70,.4],[255,.55]),
 mkPal('Autumn forest','Landscape light','Rust and gold under soft light, moss in the dark.',[.82,.05,75],[.58,.13,55],[.45,.10,38],[.70,.16,88],[.28,.045,45],[.92,.05,90],[80,.3],[160,.2]),
 mkPal('Spring meadow','Landscape light','Fresh greens with blossom pink as the accent.',[.93,.03,110],[.72,.13,132],[.60,.10,152],[.78,.11,350],[.35,.06,160],[.97,.04,100],[95,.25],[230,.25]),
 mkPal('Storm sea','Landscape light','Heavy slate sky and water, foam as the lightest note.',[.55,.02,230],[.40,.04,222],[.30,.035,205],[.86,.02,210],[.18,.02,240],[.74,.02,220],[215,.1],[240,.2],{ground:.4,dominant:.3,secondary:.14,accent:.04,dark:.1,light:.02}),
 mkPal('Moonlit night','Landscape light','Low-key blues; the moon carries all the light.',[.22,.04,262],[.30,.05,255],[.18,.03,250],[.88,.04,240],[.12,.02,260],[.60,.05,240],[240,.2],[265,.2],{ground:.5,dominant:.24,secondary:.14,accent:.02,dark:.08,light:.02}),
 mkPal('Candlelight','Interior','One warm source, deep brown dark, falloff into black.',[.20,.04,50],[.35,.08,52],[.50,.11,62],[.86,.12,82],[.12,.02,40],[.75,.12,75],[72,.6],[30,.2],{ground:.5,dominant:.22,secondary:.12,accent:.03,dark:.1,light:.03}),
 mkPal('North-window studio','Interior','Cool diffuse light; shadows turn warm.',[.82,.015,80],[.62,.03,70],[.50,.045,42],[.55,.11,26],[.28,.02,250],[.94,.012,230],[230,.3],[50,.25]),
 mkPal('Fluorescent office','Interior','Greenish flat light, low contrast, a red object for relief.',[.88,.02,150],[.72,.03,160],[.55,.05,190],[.60,.15,26],[.30,.02,200],[.96,.02,140],[140,.2],[300,.2]),
 mkPal('Portrait, fair skin, warm key','Portrait','Warm key light, cool background, warm reflected shadow.',[.40,.035,250],[.80,.06,55],[.67,.08,40],[.55,.14,24],[.22,.035,40],[.93,.04,72],[72,.4],[22,.2]),
 mkPal('Portrait, medium skin, window light','Portrait','Soft daylight, neutral warm ground.',[.70,.02,90],[.64,.08,55],[.52,.085,44],[.45,.12,20],[.20,.02,40],[.86,.05,72],[230,.15],[40,.2]),
 mkPal('Portrait, deep skin, rim light','Portrait','Dark background, cool rim, warm core.',[.25,.03,250],[.43,.07,50],[.33,.06,40],[.72,.08,232],[.15,.02,40],[.66,.07,60],[232,.3],[40,.15]),
 mkPal('Swiss poster','Graphic','Black, red, yellow on off-white paper.',[.95,.01,90],[.20,0,0],[.58,.22,28],[.86,.17,96],[.14,0,0],[1,0,0],[0,0],[0,0],{ground:.5,dominant:.22,secondary:.14,accent:.06,dark:.06,light:.02}),
 mkPal('Risograph duo','Graphic','Fluorescent pink and blue inks; their overlap as the dark.',[.96,.02,90],[.66,.20,4],[.52,.13,252],[.88,.16,100],[.36,.08,285],[.99,0,0],[0,0],[0,0]),
 mkPal('Earth pigments','Graphic','Ochre, burnt sienna and green earth: an old, cheap, stable set.',[.88,.03,80],[.73,.12,80],[.47,.10,36],[.56,.05,150],[.25,.02,50],[.94,.02,86],[80,.2],[40,.15]),
 mkPal('Teal and orange','Film grade','Skin pushed orange, everything else pushed teal.',[.36,.05,212],[.46,.07,205],[.30,.05,215],[.72,.12,55],[.15,.03,220],[.88,.05,70],[60,.3],[215,.4]),
 mkPal('Noir','Film grade','Almost no chroma; the picture lives in values.',[.20,0,0],[.35,.006,250],[.55,.006,250],[.93,.01,80],[.08,0,0],[.98,0,0],[80,.05],[250,.05],{ground:.45,dominant:.2,secondary:.14,accent:.05,dark:.12,light:.04}),
 mkPal('Bleach bypass','Film grade','Silvery, desaturated, hard contrast.',[.75,.015,100],[.55,.022,80],[.40,.03,60],[.56,.07,30],[.18,.01,0],[.92,.01,90],[90,.05],[220,.1]),
];
/* Genre palettes: the model's readings of anime-background and feature-animation conventions. Not sampled from any film. */
const P2=(n,c,t,g,d,s,a,k,l,lt,sh,pr)=>mkPal(n,c,t,g,d,s,a,k,l,lt,sh,pr?{ground:pr[0],dominant:pr[1],secondary:pr[2],accent:pr[3],dark:pr[4],light:pr[5]}:null);
const AB='Anime background',AC='Anime character',FB='Feature animation background',FC='Feature animation character';
PALETTES.push(
 P2('Summer sky, cumulus',AB,'Saturated blue sky, towering white cloud, green hills, one red roof.',[.72,.13,245],[.97,.01,240],[.55,.14,145],[.62,.19,30],[.30,.08,255],[.99,.02,95],[95,.2],[255,.5],[.4,.25,.18,.03,.1,.04]),
 P2('Cicada afternoon',AB,'Hot, bright, green-heavy; shadows lean blue.',[.90,.05,100],[.60,.15,140],[.75,.10,230],[.70,.15,55],[.32,.07,160],[.98,.04,100],[95,.35],[240,.45]),
 P2('Rainy street, neon',AB,'Wet dark street; neon pink and cyan reflections.',[.25,.04,260],[.35,.05,250],[.45,.06,220],[.70,.20,350],[.14,.03,260],[.82,.12,200],[200,.3],[270,.3],[.45,.25,.12,.05,.1,.03]),
 P2('After the rain',AB,'Clearing sky, wet greens, warm sun breaking through.',[.80,.05,220],[.55,.06,230],[.45,.08,160],[.85,.10,85],[.26,.04,240],[.96,.03,210],[90,.3],[235,.4]),
 P2('Magic hour classroom',AB,'Low sun through windows; amber walls, violet shade.',[.82,.09,75],[.62,.10,60],[.45,.06,40],[.88,.12,90],[.28,.05,300],[.95,.07,85],[70,.6],[290,.5]),
 P2('Sunset rooftop',AB,'Orange sky, purple cloud bands, silhouetted fences.',[.70,.14,40],[.55,.16,20],[.45,.10,320],[.92,.10,90],[.22,.06,290],[.95,.06,80],[55,.6],[300,.55]),
 P2('Blue-hour platform',AB,'Deep blue dusk; warm station lamps.',[.45,.09,265],[.35,.08,270],[.55,.08,300],[.88,.12,95],[.18,.05,275],[.72,.07,240],[260,.3],[280,.3],[.45,.25,.14,.03,.1,.03]),
 P2('Meteor night',AB,'Violet night sky, cyan streaks, a warm star.',[.20,.08,275],[.28,.10,285],[.40,.12,310],[.90,.10,200],[.12,.05,270],[.96,.05,90],[220,.3],[280,.2],[.5,.22,.14,.03,.08,.03]),
 P2('Cherry blossom spring',AB,'Pink canopy, soft green, pale sky.',[.92,.04,350],[.84,.07,355],[.70,.08,150],[.60,.14,20],[.35,.05,300],[.98,.02,340],[350,.2],[280,.35]),
 P2('Autumn shrine',AB,'Gold leaves, vermilion gate, mossy dark.',[.85,.07,80],[.60,.17,40],[.70,.14,75],[.58,.21,30],[.28,.05,30],[.95,.05,85],[75,.4],[280,.35]),
 P2('Snowy country night',AB,'Blue snow under a dark sky, one lit window.',[.55,.06,250],[.80,.04,245],[.30,.05,240],[.85,.13,75],[.18,.04,260],[.95,.02,240],[75,.2],[255,.4]),
 P2('Seaside town noon',AB,'Blue sea, white walls, terracotta accents.',[.80,.10,230],[.62,.14,220],[.92,.03,90],[.60,.18,35],[.35,.07,240],[.99,.01,95],[90,.2],[245,.5]),
 P2('Overgrown ruins',AB,'Grey stone swallowed by green; sky through the gaps.',[.75,.05,120],[.55,.12,135],[.62,.03,90],[.75,.10,200],[.28,.06,160],[.93,.06,110],[100,.3],[200,.3]),
 P2('Cyber city night',AB,'Violet-black towers, cyan and magenta signage.',[.16,.04,280],[.25,.06,270],[.40,.12,300],[.66,.24,350],[.10,.02,270],[.85,.12,200],[190,.3],[300,.3],[.5,.22,.12,.05,.08,.03]),
 P2('Dusk convenience store',AB,'Purple dusk outside, cold fluorescent light inside.',[.35,.07,280],[.25,.05,270],[.45,.06,200],[.95,.06,150],[.14,.03,270],[.88,.08,110],[140,.3],[285,.3]),
 P2('Bedroom morning light',AB,'Soft warm window light, cool room shadows.',[.90,.03,85],[.78,.05,70],[.65,.06,230],[.70,.12,20],[.40,.05,250],[.99,.04,90],[85,.4],[245,.4],[.42,.26,.16,.03,.08,.05]),
 P2('Summer festival lanterns',AB,'Night crowd, orange lantern strings.',[.22,.06,280],[.30,.07,270],[.45,.08,300],[.70,.19,45],[.13,.03,280],[.90,.12,85],[55,.5],[280,.3],[.45,.24,.12,.06,.1,.03]),
 P2('Deep forest spirit',AB,'Dense green shade, pale glowing motes.',[.40,.08,155],[.30,.08,160],[.55,.12,135],[.90,.10,120],[.16,.04,170],[.80,.10,115],[120,.3],[180,.3]),
 P2('Underwater light',AB,'Blue-green depth, caustic highlights, one bright fish.',[.55,.10,215],[.45,.10,225],[.65,.10,195],[.75,.15,60],[.22,.06,240],[.90,.06,190],[190,.3],[240,.35]),
 P2('Hangar, industrial',AB,'Steel greys, hazard yellow.',[.50,.02,230],[.40,.03,220],[.58,.04,80],[.70,.18,60],[.18,.02,230],[.85,.02,210],[210,.1],[230,.15]),
 P2('Desert ruins, epic',AB,'Sand and sandstone under a deep blue sky.',[.82,.07,70],[.65,.10,55],[.55,.07,40],[.55,.13,240],[.30,.05,30],[.96,.04,80],[80,.3],[250,.4]),
 P2('Twilight power lines',AB,'Mauve sky, peach horizon, black wires and poles.',[.65,.10,320],[.75,.10,50],[.40,.06,280],[.95,.08,90],[.18,.03,280],[.90,.07,60],[50,.4],[290,.4]),
 P2('Pastel slice of life',AB,'Soft mint, blush and cream; almost no dark.',[.94,.03,90],[.86,.06,200],[.86,.07,340],[.80,.10,60],[.55,.05,280],[.99,.01,90],[90,.2],[260,.25],[.45,.25,.18,.04,.04,.04]),
 P2('Crimson battle sky',AB,'Red sky, black smoke, gold light.',[.45,.18,28],[.30,.14,25],[.60,.16,50],[.92,.10,95],[.14,.05,20],[.85,.12,70],[60,.4],[10,.2]),
 P2('Grey rain, melancholy',AB,'Low-contrast grey city, one red umbrella.',[.62,.015,240],[.50,.02,230],[.40,.03,200],[.60,.10,20],[.25,.02,240],[.80,.01,230],[230,.1],[240,.2]),
 P2('Shonen hero',AC,'Orange and navy with a yellow accent.',[.92,.02,90],[.70,.18,55],[.35,.10,265],[.85,.16,95],[.20,.03,265],[.97,.02,80],[80,.3],[260,.3]),
 P2('Magical girl',AC,'Pink and lilac with gold trim.',[.95,.03,350],[.75,.14,350],[.85,.08,300],[.88,.14,95],[.40,.12,320],[.99,.02,340],[340,.2],[300,.3]),
 P2('Cool rival',AC,'Near-black and ice blue with a red detail.',[.90,.01,240],[.30,.04,260],[.70,.06,230],[.55,.18,20],[.15,.02,260],[.96,.01,240],[230,.2],[260,.3]),
 P2('School uniform',AC,'Navy, slate and white with a red ribbon.',[.93,.02,90],[.32,.06,260],[.62,.05,250],[.55,.19,25],[.18,.03,260],[.99,0,0],[90,.2],[260,.3]),
 P2('Mecha pilot',AC,'White armour, blue panels, red markings.',[.60,.02,230],[.92,.01,90],[.50,.14,255],[.60,.20,28],[.22,.03,250],[.98,.01,90],[220,.2],[250,.3]),
 P2('Villain in shadow',AC,'Violet dark with a red eye-light.',[.18,.03,300],[.25,.05,300],[.40,.10,320],[.60,.22,25],[.10,.02,300],[.75,.08,320],[320,.3],[300,.2]),
 P2('Idol stage',AC,'Hot pink and sky blue under stage light.',[.25,.10,300],[.70,.18,340],[.75,.14,220],[.92,.12,95],[.15,.06,290],[.97,.03,320],[320,.3],[290,.3]),
 P2('Storybook watercolour forest',FB,'Soft greens and ochres, warm light, a red cape.',[.88,.04,110],[.66,.09,135],[.55,.07,90],[.62,.15,30],[.32,.05,160],[.96,.04,100],[95,.3],[220,.3]),
 P2('Enchanted castle night',FB,'Indigo sky, lilac towers, gold fireworks.',[.28,.08,275],[.40,.09,280],[.55,.10,300],[.90,.12,90],[.15,.05,275],[.85,.06,260],[250,.3],[280,.3]),
 P2('Fairy-tale village morning',FB,'Cream plaster, warm timber, red roofs, green hills.',[.92,.05,90],[.78,.09,70],[.65,.10,140],[.58,.17,25],[.40,.06,40],[.98,.03,95],[85,.35],[240,.35]),
 P2('Jungle canopy',FB,'Layered greens with a hot flower or bird.',[.55,.11,145],[.42,.12,150],[.65,.14,125],[.70,.19,45],[.20,.06,165],[.88,.10,115],[110,.4],[180,.3]),
 P2('Savanna sunrise',FB,'Orange sky, gold grass, dark silhouettes.',[.80,.12,65],[.62,.16,45],[.45,.12,30],[.90,.12,90],[.20,.05,30],[.95,.08,85],[65,.6],[20,.3]),
 P2('Under the sea kingdom',FB,'Aqua water, teal rock, coral red.',[.58,.11,205],[.48,.12,215],[.68,.12,180],[.65,.20,20],[.25,.07,240],[.90,.07,190],[190,.3],[240,.35]),
 P2('Villain lair',FB,'Purple-black stone, poison green light.',[.22,.06,300],[.30,.09,300],[.55,.18,140],[.75,.22,135],[.12,.04,300],[.70,.14,140],[140,.5],[300,.3],[.45,.25,.12,.06,.1,.02]),
 P2('Grand ballroom',FB,'Gold and warm brown with a blue gown.',[.60,.10,70],[.72,.14,80],[.40,.10,40],[.70,.12,240],[.25,.06,40],[.95,.07,85],[80,.5],[40,.2]),
 P2('Ice palace',FB,'Frost blues and violet with a magenta note.',[.85,.06,225],[.72,.10,230],[.55,.12,260],[.75,.12,320],[.30,.08,265],[.98,.03,220],[220,.3],[270,.3]),
 P2('Bayou fireflies',FB,'Humid teal night, yellow-green fireflies.',[.30,.07,180],[.38,.08,165],[.25,.06,280],[.92,.15,105],[.15,.04,200],[.70,.10,150],[110,.3],[260,.3],[.45,.25,.14,.03,.1,.03]),
 P2('Desert palace night',FB,'Blue night, sandstone, gold domes.',[.30,.08,270],[.45,.10,265],[.60,.10,70],[.80,.14,85],[.16,.05,270],[.88,.06,250],[85,.3],[265,.3]),
 P2('Candlelit cottage',FB,'Warm brown interior, one bright flame.',[.30,.06,55],[.45,.10,55],[.35,.06,30],[.88,.13,85],[.16,.03,40],[.78,.12,75],[75,.6],[30,.2],[.45,.25,.13,.03,.11,.03]),
 P2('Mid-century flat',FB,'Limited flat palette: teal, mustard, tomato on cream.',[.90,.04,95],[.60,.10,200],[.70,.13,70],[.58,.18,30],[.25,.02,60],[.98,.01,95],[0,0],[0,0],[.4,.25,.18,.07,.07,.03]),
 P2('Early sepia cartoon',FB,'Ink black on aged paper, faint warm tints.',[.88,.03,85],[.20,.01,60],[.65,.04,70],[.55,.10,40],[.10,0,0],[.97,.02,85],[0,0],[0,0]),
 P2('Golden-age sunset',FB,'Glowing orange and rose sky, violet mountains.',[.68,.15,40],[.55,.17,25],[.45,.12,340],[.92,.12,90],[.20,.06,300],[.93,.08,70],[55,.6],[300,.5]),
 P2('Suburban daylight',FB,'Blue sky, green lawn, cream houses, a red mailbox.',[.80,.09,230],[.70,.14,140],[.85,.05,80],[.62,.19,28],[.35,.05,250],[.98,.03,95],[90,.3],[245,.4]),
 P2('Toy room',FB,'Primary-ish blue, orange and red on warm wood.',[.85,.05,80],[.62,.16,250],[.70,.17,55],[.60,.21,28],[.35,.06,40],[.96,.04,90],[80,.3],[250,.3]),
 P2('Tropical island',FB,'Lagoon turquoise, palm green, hibiscus, pale sand.',[.82,.10,210],[.70,.13,190],[.55,.15,140],[.72,.18,40],[.30,.07,170],[.96,.05,95],[90,.3],[220,.4]),
 P2('Underworld blue flame',FB,'Blue-black cavern, blue fire, one orange flare.',[.18,.04,260],[.28,.06,250],[.50,.12,220],[.65,.20,35],[.10,.02,260],[.80,.12,210],[210,.4],[260,.2],[.48,.24,.12,.04,.1,.02]),
 P2('Rooftops at dusk',FB,'Mauve sky, slate roofs, warm windows.',[.60,.07,300],[.45,.06,270],[.65,.08,50],[.85,.13,85],[.22,.04,270],[.85,.06,40],[50,.4],[275,.4]),
 P2('Marigold festival',FB,'Marigold, magenta and turquoise on a night purple.',[.30,.09,300],[.72,.17,65],[.55,.18,350],[.80,.14,190],[.16,.05,300],[.92,.11,85],[65,.4],[300,.3]),
 P2('Autumn pumpkin patch',FB,'Pumpkin orange, dry grass, harvest moon.',[.75,.08,70],[.65,.17,50],[.45,.08,120],[.85,.15,90],[.25,.05,40],[.93,.06,85],[70,.4],[280,.3]),
 P2('Northern lights',FB,'Night blue with green and pink aurora.',[.22,.06,260],[.30,.07,250],[.60,.16,160],[.60,.18,330],[.12,.03,260],[.92,.04,230],[160,.3],[260,.3]),
 P2('Garden tea party',FB,'Mint, rose and cream with a lemon accent.',[.92,.05,120],[.80,.09,140],[.82,.08,350],[.70,.14,60],[.40,.07,160],[.98,.02,100],[95,.2],[200,.2]),
 P2('Pirate cove',FB,'Sea blue, weathered wood, a red flag.',[.62,.10,210],[.45,.08,60],[.55,.12,190],[.62,.20,28],[.22,.05,230],[.92,.05,90],[85,.3],[235,.35]),
 P2('Classic princess',FC,'Powder blue gown, gold hair, rose accent.',[.93,.03,90],[.78,.10,240],[.82,.12,85],[.58,.18,20],[.30,.06,260],[.98,.02,90],[85,.3],[260,.3]),
 P2('Villain queen',FC,'Violet-black robes, magenta lining, red lips.',[.25,.06,300],[.32,.10,300],[.55,.18,320],[.62,.22,25],[.12,.03,300],[.80,.10,320],[320,.3],[300,.2]),
 P2('Scrappy hero',FC,'Rust tunic, worn leather, a blue sash.',[.90,.03,85],[.60,.14,40],[.50,.07,70],[.60,.16,240],[.25,.04,40],[.97,.03,85],[80,.3],[240,.3]),
 P2('Comic sidekick',FC,'Leaf green and yellow with a red spot.',[.90,.05,120],[.72,.16,130],[.80,.14,80],[.62,.20,30],[.30,.08,150],[.97,.04,110],[100,.3],[200,.3]),
 P2('Wise mentor',FC,'Deep purple robe, white beard, a gold glint.',[.80,.05,70],[.55,.08,280],[.85,.02,90],[.80,.14,85],[.25,.05,280],[.96,.02,90],[80,.3],[280,.3]),
 P2('Sea creature friend',FC,'Yellow and blue on aqua with a red fin.',[.75,.09,205],[.70,.14,90],[.55,.14,230],[.62,.20,28],[.28,.07,240],[.95,.05,200],[190,.3],[240,.3]),
 P2('Robot companion',FC,'White shell, gunmetal joints, cyan light.',[.85,.02,230],[.92,.01,90],[.50,.03,240],[.65,.15,200],[.20,.02,240],[.99,0,0],[200,.2],[240,.2]),
 P2('Dragon',FC,'Green scales, red belly, orange fire.',[.30,.05,160],[.45,.14,150],[.35,.12,20],[.75,.18,55],[.15,.04,160],[.85,.10,90],[60,.4],[180,.3])
);


export const clonePal = (p) => JSON.parse(JSON.stringify(p));
export const palByName = (n) => PALETTES.find((p) => p.name === n);

// Five steps per role. Steps into shadow drift toward the shadow hue, steps into light toward
// the light hue; near-greys take the tint hue outright.
export function rampOf(p, role) {
  const [L, C, H] = p.roles[role];
  return STEPS.map((dl) => {
    const t = Math.abs(dl) / 0.26;
    let h = H, c = C;
    const l = clamp(L + dl, 0.02, 0.995);
    if (dl < 0) { h = mixHue(H, p.shadow.h, C < 0.02 ? 1 : p.shadow.amt * t); c = C * (1 - 0.15 * t) + p.shadow.amt * 0.035 * t; }
    else if (dl > 0) { h = mixHue(H, p.light.h, C < 0.02 ? 1 : Math.min(1, p.light.amt * t * 1.5)); c = C * (1 - 0.25 * t) + p.light.amt * 0.025 * t; }
    return [l, c, h];
  });
}

export const lchToLab = (c) => [c[0], c[1] * Math.cos((c[2] * Math.PI) / 180), c[1] * Math.sin((c[2] * Math.PI) / 180)];
export const labToLch = (l) => [l[0], Math.hypot(l[1], l[2]), ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360];
export const lchHex = (c) => '#' + labToRgb(...lchToLab(c)).map((v) => v.toString(16).padStart(2, '0')).join('');
export const lchCss = (c) => rgbCss(labToRgb(...lchToLab(c)));
export const hexToLch = (h) => labToLch(hexToLab(h));
export function lchClipped(c) {
  // does the colour need its chroma reduced to fit on screen?
  const [L, a, b] = lchToLab(c);
  const back = labToLch(hexToLab(lchHex(c)));
  return Math.abs(back[1] - c[1]) > 0.012 && c[1] > 0.02 && L > 0 && (a || b);
}

// Generator: base hue + a hue scheme + a value key + a chroma level + a light temperature.
export const GEN_OPTS = {
  scheme: [['mono', 'Mono'], ['analogous', 'Analogous'], ['complementary', 'Compl.'], ['split', 'Split'], ['triadic', 'Triadic'], ['tetradic', 'Square']],
  key: [['high', 'High key'], ['mid', 'Mid key'], ['low', 'Low key']],
  chroma: [['muted', 'Muted'], ['natural', 'Natural'], ['vivid', 'Vivid']],
  temp: [['warm', 'Warm light'], ['neutral', 'Neutral'], ['cool', 'Cool light']],
};
export function generatePalette(g, base, locked) {
  const H = g.hue;
  const off = { mono: [0, 0, 0], analogous: [0, 32, -30], complementary: [0, 14, 180], split: [0, 150, 210], triadic: [0, 120, 240], tetradic: [0, 90, 180] }[g.scheme];
  const K = { high: { ground: 0.94, dominant: 0.8, secondary: 0.68, accent: 0.62, dark: 0.38, light: 0.98 }, mid: { ground: 0.74, dominant: 0.56, secondary: 0.45, accent: 0.66, dark: 0.22, light: 0.92 }, low: { ground: 0.22, dominant: 0.32, secondary: 0.42, accent: 0.74, dark: 0.12, light: 0.82 } }[g.key];
  const Cm = { muted: [0.02, 0.05, 0.1], natural: [0.03, 0.1, 0.16], vivid: [0.05, 0.16, 0.22] }[g.chroma];
  const T = { warm: [75, 0.4, 265, 0.45], neutral: [90, 0.05, 250, 0.08], cool: [235, 0.35, 50, 0.25] }[g.temp];
  const p = base ? clonePal(base) : mkPal('Generated', 'Generated', '', [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0], [0, 0]);
  const set = (r, v) => { if (!locked || !locked[r]) p.roles[r] = v; };
  set('ground', [K.ground, Cm[0], mixHue(H + off[0], T[0], 0.5)]);
  set('dominant', [K.dominant, Cm[1], (H + off[0] + 360) % 360]);
  set('secondary', [K.secondary, Cm[1] * 0.9, (H + off[1] + 360) % 360]);
  set('accent', [K.accent, Cm[2], (H + off[2] + 360) % 360]);
  set('dark', [K.dark, Cm[0] * 1.2, T[2]]);
  set('light', [K.light, Cm[0] * 0.6, T[0]]);
  p.light = { h: T[0], amt: T[1] };
  p.shadow = { h: T[2], amt: T[3] };
  p.name = `${g.scheme[0].toUpperCase() + g.scheme.slice(1)}, ${g.key} key, ${g.temp} light`;
  p.cat = 'Generated';
  p.note = `Base hue ${Math.round(H)}\u00b0, ${g.chroma} chroma.`;
  return p;
}

// Quick checks on a palette; thresholds were chosen by the model that built Chroma Mat.
export function paletteChecks(p) {
  const R = p.roles, out = [];
  const ls = ROLES.map((r) => R[r][0]), span = Math.max(...ls) - Math.min(...ls);
  out.push({ k: span >= 0.55 ? 'ok' : 'warn', t: `Value range across roles is ${span.toFixed(2)} in lightness${span >= 0.55 ? '' : '; the picture will read flat unless that is the intent (fog, high key)'}.` });
  const dg = Math.abs(R.dominant[0] - R.ground[0]);
  out.push({ k: dg >= 0.12 ? 'ok' : 'warn', t: `Dominant vs ground: lightness gap ${dg.toFixed(2)}${dg >= 0.12 ? '' : '; the main masses may dissolve into the ground'}.` });
  const acc = R.accent[1], maxOther = Math.max(...['ground', 'dominant', 'secondary', 'dark', 'light'].map((r) => R[r][1]));
  out.push({ k: acc >= maxOther ? 'ok' : 'warn', t: acc >= maxOther ? 'Accent is the most colourful role, so it can work at small size.' : `Accent chroma ${acc.toFixed(3)} is below another role (${maxOther.toFixed(3)}); it may not stand out.` });
  const gg = R.ground[0];
  out.push({ k: 'info', t: `Key: ground lightness ${gg.toFixed(2)}, ${gg > 0.7 ? 'high key (light picture)' : gg < 0.35 ? 'low key (dark picture)' : 'mid key'}.` });
  const sumP = ROLES.reduce((a, r) => a + (p.props[r] || 0), 0);
  out.push({ k: 'info', t: `Target shares add to ${Math.round(sumP * 100)}%. Splits like 60-30-10 are a decorating convention, not a finding.` });
  return out;
}

// Palette from a picture: six colour clusters in OKLab mapped to roles by area, lightness and chroma.
export function paletteFromImage(img, name) {
  const c = document.createElement('canvas'), s = Math.min(1, 120 / Math.max(img.width, img.height));
  c.width = Math.max(1, Math.round(img.width * s));
  c.height = Math.max(1, Math.round(img.height * s));
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data, px = [];
  for (let i = 0; i < d.length; i += 4) px.push(hexToLab('#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')));
  const K = 6;
  let cen = [];
  for (let i = 0; i < K; i++) cen.push(px[Math.floor(((i + 0.5) / K) * px.length)].slice());
  const asg = new Array(px.length).fill(0);
  for (let it = 0; it < 14; it++) {
    for (let i = 0; i < px.length; i++) {
      let b = 0, bd = 1e9;
      for (let k = 0; k < K; k++) { const q = cen[k], dd = (px[i][0] - q[0]) ** 2 + (px[i][1] - q[1]) ** 2 + (px[i][2] - q[2]) ** 2; if (dd < bd) { bd = dd; b = k; } }
      asg[i] = b;
    }
    const sum = cen.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s2 = sum[asg[i]]; s2[0] += p[0]; s2[1] += p[1]; s2[2] += p[2]; s2[3]++; });
    cen = sum.map((s2, k) => (s2[3] ? [s2[0] / s2[3], s2[1] / s2[3], s2[2] / s2[3]] : cen[k]));
  }
  const cnt = new Array(K).fill(0);
  asg.forEach((a) => cnt[a]++);
  const cl = cen.map((q, k) => ({ L: q[0], C: Math.hypot(q[1], q[2]), H: ((Math.atan2(q[2], q[1]) * 180) / Math.PI + 360) % 360, a: cnt[k] / px.length }));
  const take = (better) => { let b = 0; cl.forEach((q, i) => { if (better(q, cl[b])) b = i; }); return cl.splice(b, 1)[0]; };
  const dark = take((q, b) => q.L < b.L), light = take((q, b) => q.L > b.L), accent = take((q, b) => q.C * (1 - q.a) > b.C * (1 - b.a));
  const ground = take((q, b) => q.a > b.a), dominant = take((q, b) => q.a > b.a), secondary = cl[0] || dominant;
  const toR = (o) => [o.L, o.C, o.H], tot = [ground, dominant, secondary, accent, dark, light].reduce((a, o) => a + o.a, 0) || 1;
  return mkPal('From ' + name.replace(/\.[^.]+$/, ''), 'From image', 'Six OKLab clusters mapped to roles.', toR(ground), toR(dominant), toR(secondary), toR(accent), toR(dark), toR(light), [light.H, 0.2], [dark.H, 0.3],
    { ground: ground.a / tot, dominant: dominant.a / tot, secondary: secondary.a / tot, accent: accent.a / tot, dark: dark.a / tot, light: light.a / tot });
}

// Exports: JSON, CSS variables, a Blender script and a three.js module.
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linOf = (c) => labToRgb(...lchToLab(c)).map((v) => +s2l(v / 255).toFixed(5));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export function paletteJSON(p, lightDeg) {
  const o = { name: p.name, setting: p.cat, note: p.note, colorSpace: 'OKLCH (L 0-1, C, H degrees); hex = sRGB; linear = scene-linear sRGB', light: p.light, shadow: p.shadow, lightDirectionDeg: lightDeg, proportions: p.props, roles: {} };
  for (const r of ROLES) o.roles[r] = { oklch: p.roles[r].map((v) => +v.toFixed(4)), hex: lchHex(p.roles[r]), linear: linOf(p.roles[r]), ramp: rampOf(p, r).map((c, i) => ({ step: i - 2, oklch: c.map((v) => +v.toFixed(4)), hex: lchHex(c), linear: linOf(c) })) };
  return o;
}
export function exportPalette(kind, p, lightDeg) {
  const o = paletteJSON(p, lightDeg);
  if (kind === 'json') return JSON.stringify(o, null, 1);
  if (kind === 'css') return `/* ${o.name} */\n:root{\n` + ROLES.map((r) => `  --${r}: ${o.roles[r].hex};\n` + o.roles[r].ramp.map((s) => `  --${r}-${s.step < 0 ? 'm' + -s.step : s.step === 0 ? '0' : 'p' + s.step}: ${s.hex};`).join('\n')).join('\n') + '\n}';
  if (kind === 'blender') return `# ${o.name}: paste into Blender's Text Editor and Run Script\n# Colours are scene-linear, as Principled BSDF Base Color expects.\nimport bpy\nPALETTE = {\n` + ROLES.map((r) => o.roles[r].ramp.map((s) => `    "${slug(o.name)}_${r}_${s.step < 0 ? 'm' + -s.step : s.step === 0 ? 'base' : 'p' + s.step}": (${s.linear.join(', ')}),`).join('\n')).join('\n') + '\n}\nfor name, rgb in PALETTE.items():\n    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)\n    m.use_nodes = True\n    bsdf = m.node_tree.nodes.get("Principled BSDF")\n    if bsdf:\n        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)\n    m.diffuse_color = (*rgb, 1.0)\n    m.use_fake_user = True\nprint("Created", len(PALETTE), "materials")';
  return `// ${o.name}. Values are linear; with renderer.outputColorSpace = SRGBColorSpace use Color.setRGB(r,g,b) directly.\nexport const palette = {\n` + ROLES.map((r) => `  ${r}: { base: [${o.roles[r].linear.join(', ')}], ramp: [${o.roles[r].ramp.map((s) => '[' + s.linear.join(', ') + ']').join(', ')}] },`).join('\n') + '\n};';
}
