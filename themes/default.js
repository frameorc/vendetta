const alias = {
  flexAlignH: {
    l: 'flex-start',
    r: 'flex-end',
  },
  flexAlignV: {
    t: 'flex-start',
    b: 'flex-end',
  },
  flexAlign: {
    s: 'flex-start',
    e: 'flex-end',
    c: 'center',
    ar: 'space-around',
    bw: 'space-between',
    ev: 'space-evenly',
    bl: 'baseline',
    blf: 'first baseline',
    bll: 'last baseline',
    st: 'stretch',
    ss: 'self-start',
    se: 'self-end',
  },
  gridAutoFlow: {
    'col': 'column',
    'col*': 'column dense',
    'row': 'row',
    'row*': 'row dense'
  },
  overflow: {
    '-': "hidden",
    '~': "auto",
    '+': "scroll"
  },
  size: {
    f: '100%',
    a: 'auto',
    mx: 'max-content',
    mn: 'min-content',
    ft: 'fit-content',
    fl: 'fill-available',
  },
  textAlign: {
    s: 'start',
    l: 'left',
    m: 'middle',
    r: 'right',
    e: 'end',
    j: 'justify',
    ja: 'justify-all',
    mp: 'match-parent'
  },
  borderStyle: {
    '-': 'solid',
    '.': 'dotted',
    '~': 'wavy',
    '--': 'dashed',
    '=': 'double'
  },
  textTransform: {
    u: 'uppercase',
    l: 'lowercase',
    c: 'capitalize'
  },
  userSelect: {
    '-': 'none',
    '~': 'auto',
    t: 'text',
    a: 'all',
    c: 'contain'
  },
  visibility: {
    '-': 'hidden',
    '+': 'visible',
    c: 'collapse',
  },
  wordBreak: {
    '-': 'keep-all',
    w: 'break-word',
    a: 'break-all',
  },
  whiteSpace: {
    nw: 'nowrap',
    p: 'pre',
    pw: 'pre-wrap',
    pl: 'pre-line',
    bs: 'break-spaces'
  }
}

const sides = { '': [''] }
sides.T = ['Top'];
sides.B = ['Bottom'];
sides.L = ['Left'];
sides.R = ['Right'];
sides.h = sides.H = ['Left', 'Right'];
sides.v = sides.V = ['Top', 'Bottom'];
sides.t = ['BlockStart'];
sides.b = ['BlockEnd'];
sides.l = ['InlineStart'];
sides.r = ['InlineEnd'];

const corners = { '': [''] }
corners.TL = corners.tl = ['StartStart'];
corners.TR = corners.tr = ['StartEnd'];
corners.BL = corners.bl = ['EndStart'];
corners.BR = corners.br = ['EndEnd'];
corners.T  = corners.t  = [corners.tl, corners.tr];
corners.B  = corners.b  = [corners.bl, corners.br];
corners.L  = corners.l  = [corners.tl, corners.bl];
corners.R  = corners.r  = [corners.tr, corners.br];

const some = (args, r) => {
  for (let i = 0; i < args.length; i++) {
    const av = args[i];
    const v = typeof r == 'object' ? r[av] : r(av);
    if (v) return (args.splice(i, 1)[0], v);
  }
  return null;
}

const def = (obj, methodName, func) =>
  Object.fromEntries(Object.entries(obj).map(([name, props]) => [
    methodName(name),
    (s, ...a) => props.forEach((p) => func(p)(s, ...a))
  ]));

const gridTrack = (size, str) => {
  let [ , count, track=''] = str.match(/(.*)\[(.*)\]/) ?? [null, str];
  count = +count;
  const [head, repeat=[]] = track.split('|').map(a =>
    a.split(/\s+/).filter(v=>v).map(size)
  );

  if (isNaN(count)) return '';
  if (!repeat.length) return [...head,
    `repeat(${count - head.length},1fr)`
  ].join(' ');
  
  const tail = repeat.slice(0, (count - head.length) % repeat.length);
  const repeatCount = (count - head.length - tail.length) / repeat.length;
  return [...head,
    `repeat(${repeatCount},${repeat.join(' ')})`, ...tail
  ].join(' ');
}

export const methods = ({
  size,
  color=v=>v,
  textSize=v=>v,
  lineHeight=v=>v,
  shadow=v=>v
}) => ({
  // composition
  grid: Object.assign((s, str) => {
    s.display = 'grid';
    const args = str.split(/\s+(?![^\[]*\])/);
    s.gridAutoFlow = some(args, alias.gridAutoFlow);
    if (args[0]) s.gridTemplateColumns = gridTrack(size, args[0]);
    if (args[1]) s.gridTemplateRows = gridTrack(size, args[1]);
  }, { rawArgs: true }),
  row: (s, ...a) => (
    s.display = 'flex',
    s.flexDirection = 'row',
    s.justifyContent = some(a, alias.flexAlignH),
    s.alignItems = some(a, alias.flexAlignV)),
  col: (s, ...a) => (
    s.display = 'flex',
    s.flexDirection = 'column',
    s.alignItems = some(a, alias.flexAlignH),
    s.justifyContent = some(a, alias.flexAlignV)),
  span: (s, x, y) => (
    s.gridRow = x ? `span ${x} / span ${x}` : '',
    s.gridColumn = y ? `span ${y} / span ${y}` : ''),
  gap: (s, x, y=x) => (
    s.columnGap = size(x) ?? x,
    s.rowGap = size(y) ?? y),
  rigid: (s) => s.flexShrink = 0,
  flex: (s, v) => s.flex = v,
  
  // size
  w: (s, v) => s.width = alias.size[v] ?? size(v),
  mnw: (s, v) => s.minWidth = alias.size[v] ?? size(v),
  mxw: (s, v) => s.maxWidth = alias.size[v] ?? size(v),
  h: (s, v) => s.height = alias.size[v] ?? size(v),
  mnh: (s, v) => s.minHeight = alias.size[v] ?? size(v),
  mxh: (s, v) => s.maxHeight = alias.size[v] ?? size(v),
  
  // text
  ta: (s, v) => s.textAlign = alias.textAlign[v] ?? v,
  tc: (s, c) => s.color = color(c),
  td: (s, v) => s.textDecoration = (alias.borderStyle[v] ?? v) + ' underline',
  tf: (s, f) => s.fontFamily = f,
  tl: (s, v) => s.lineHeight = lineHeight(v),
  ts: (s, v) => s.fontSize = textSize(v),
  tt: (s, v) => s.textTransform = alias.textTransform[v] ?? v,
  tw: (s, v) => s.fontWeight = v,
  tlc: (s, n) => s.WebkitLineClamp = s.lineClamp = n,
  tov: (s, v) => s.textOverflow = v,
  tws: (s, v) => s.whiteSpace = alias.whiteSpace[v] ?? v,
  twb: (s, v) => s.wordBreak = alias.wordBreak[v] ?? v,
  
  // padding, margin, border, border-radius
  ...def(sides,   _=>'p'+_,  _=>(s, v) => s[`padding${_}`] = size(v)),
  ...def(sides,   _=>'m'+_,  _=>(s, v) => s[`margin${_}`] = size(v)),
  ...def(corners, _=>'r'+_,  _=>(s, v) => s[`border${_}Radius`] = size(v)),
  ...def(sides,   _=>'br'+_, _=>(s, ...a) => (
    s[`border${_}Color`] = some(a, color) ?? 'currentColor',
    s[`border${_}Width`] = some(a, size) ?? '1px',
    s[`border${_}Style`] = some(a, alias.borderStyle) ?? 'solid'
  )),
  
  // outline
  ol: (s, ...a) => (
    s.outlineColor = some(a, color) ?? 'currentColor',
    s.outlineWidth = some(a, size) ?? '1px',
    s.outlineOffset = some(a, size) ?? '1px',
    s.outlineStyle = some(a, alias.borderStyle) ?? 'solid'
  ),
  
  // ring
  ring: (s, w='2px', cl="currentColor", of='2px', ofcl='white') =>
    s.boxShadow = [
      `0 0 0 ${size(of)}`, color(ofcl), ',',
      `0 0 0 calc(${size(w)} + ${size(of)})`, color(cl)
    ].join(' '),

  // inset
  i: (s, v) => s.inset = size(v),
  it: (s, v) => s.top = size(v),
  il: (s, v) => s.left = size(v),
  ib: (s, v) => s.bottom = size(v),
  ir: (s, v) => s.right = size(v),

  // common
  z: (s, v) => s.zIndex = v,
  d: (s, v) => s.display = v,
  bg: (s, c) => s.background = color(c),
  abs: (s) => s.position = 'absolute',
  rel: (s) => s.position = 'relative',
  fix: (s) => s.position = 'fixed',
  stt: (s) => s.position = 'static',
  stc: (s) => s.position = 'sticky',
  va: (s, v) => s.verticalAlign = v,
  sh: (s, sh) => s.boxShadow = shadow(sh),
  ov: (s, x, y=x) => (
    s.overflowX = alias.overflow[x] ?? x,
    s.overflowY = alias.overflow[y] ?? y
  ),
  sel: (s, v) => s.userSelect = alias.userSelect[v] ?? v,
  vis: (s, v) => s.visibility = alias.visibility[v] ?? v,
  ptr: (s, v) => (
    v == '-'
    ? s.pointerEvents = 'none'
    : s.cursor = 'pointer'
  ),
  
  // transform
  ...Object.fromEntries([
    ['mat', 'matrix'],
    ['mat3', 'matrix3d'],
    ['skw', 'skew'],
    ['skwX', 'skewX'],
    ['skwY', 'skewY'],
    ['scl', 'scale'],
    ['scl3', 'scale3d'],
    ['sclX', 'scaleZ'],
    ['sclY', 'scaleY'],
    ['sclZ', 'scaleZ'],
    ['rot', 'rotate'],
    ['rot3', 'rotate3d'],
    ['rotX', 'rotateZ'],
    ['rotY', 'rotateY'],
    ['rotZ', 'rotateZ'],
  ].map(([name, prop]) => [name, (s, ...v) => (
    s.transform ??= '',
    s.transform += prop + '(' + v.join(',') + ')'
  )])),
  
  ...Object.fromEntries([
    ['prs', 'perspective'],
    ['tsl', 'translate'],
    ['tsl3', 'translate3d'],
    ['tslX', 'translateX'],
    ['tslY', 'translateY'],
    ['tslZ', 'translateZ'],
  ].map(name => [name, (s, ...v) => (
    s.transform ??= '',
    s.transform += name + '(' + v.map(v => size(v)).join(',') + ')'
  )])),
});
