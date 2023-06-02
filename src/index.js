const ID = ((v={}, i=0) => (...s) => v[s] ??= i++)();
const kebab = s => s.replaceAll(/[A-Z]/g, c => '-' + c.toLowerCase());
const selStr = key =>
  key[0] == '$'
  ? '::' + kebab(key.slice(1))
  : ':' + kebab(key).slice(1);
const styleStr = (style, important) => `{${
  Object.entries(style).map(([k, v]) =>
    kebab(k) + ': ' + v + (important ? ' !important' : '') + ';'
  ).join('')
}}`;

const CALLS = Symbol('VENDETTA_CALLS');
export const unwrap = v =>
  v?.[CALLS] ? v[CALLS]
  : typeof v == 'function' ? unwrap(v())
  : Array.isArray(v) ?
    Object.hasOwn(v[0], 'raw')
    ? v[0].flatMap((a,i) => [a, unwrap(v[i+1] ?? '')]).filter(v=>v)
    : v.flatMap(unwrap)
  : [v];

const init = calls => calls.length
  ? calls
  : [{ sel: '', props: [], group: undefined }];
const combine = (calls1, calls2) => reduce(
  init(calls1).flatMap(c1 =>
    init(calls2).map(c2 => ({
      important: c2.important,
      inline: c2.inline,
      group: c2.group ?? c1.group,
      sel: (c1.sel ?? '') + (c2.sel ?? ''),
      media: [c1.media, c2.media].filter(v => v).join(' and '),
      animations: { ...(c1.animations ?? {}), ...(c2.animations ?? {}) },
      transition: { ...(c1.transition ?? {}), ...(c2.transition ?? {}) },
      style: { ...(c1.style ?? {}), ...(c2.style ?? {}) },
    }))));
const reduce = calls => Object.values(calls.reduce((acc, v) => {
  const r = acc[v.sel + v.media + v.important + v.group] ??= {...v};
  Object.assign((r.animations ??= {}), v.animations ?? {});
  Object.assign((r.transition ??= {}), v.transition ?? {});
  Object.assign((r.style ??= {}), v.style ?? {});
  return acc;
}, {}));

const Media = ([media, ...args], last) => combine(args, [{ media }]);
const Style = (args) => combine(args, [{ inline: true }]);
const Important = (args) => combine(args, [{ important: true }]);
const Group = (args) => combine(args, [{ group: 'ref' }]);
Group.chain = (key) => ({ group: 'create' });

const Transition = ([param, ...args]) => args.concat({
  transition: Object.fromEntries(args
    .flatMap(arg => Object.keys(arg.style ?? {}))
    .map(k => [k, param]))
});
const Animation = ([param, ...keyframes], last) => {
  const kf = keyframes.reduce((l, v) => (
    ('sel' in v ? l[0] : l).push(v)
  , l), [[]]);
  kf[0] = Object.fromEntries(kf[0].map((v, i) =>
    [i / (kf[0].length - 1) * 100, v]
  ));
  const anim = kf.filter(v => Object.keys(v).length).map(v => ({
    param,
    keyframes: Object.entries(v).map(([ident, args]) => [
      ident,
      unwrap([args]).reduce((r, v) => Object.assign(r, v.style), {})
    ])
  }));
  return [{animations: {...last.animations, [Math.random()]: anim}}];
}

const Property = (args, last, ctx) => {
  const splitArgs = args.join('').split(/\s+/);
  return [{
    style: {
      ...last.style,
      ...last.props
        .map(prop => ctx.methods[prop.key])
        .reduce((acc, method) => (
          method(acc, ...(method.rawArgs ? args : splitArgs)),
        acc), {})
    }
  }];
}
Property.chain = (key, last) => ({ props: [...(last.props ?? []), {key}] });

const Selector = (args, last) => args.map(arg => ({
  ...arg,
  sel: (arg.sel ? '(' + arg.sel + ')' : '')
}));
Selector.chain = (key, last) => ({ sel: (last.sel ?? '') + selStr(key) });

const operators = { Style, Important, Group, Media, Animation, Transition }

const chain = (calls, key, ctx) => {
  const last = init(calls).at(-1);
  const op = operators[key] ?? (/[a-z]/.test(key[0]) ? Property : Selector);
  if (calls.length > 1 && (!last.op || last.op == Group) || last.op && (
    op == Property
    ? last.op != Property && last.op != Selector
    : last.op != Selector
  )) throw new Error('not chainable');
  return stack(ctx, [{...last, op, ...(op.chain?.(key, last) ?? {})}]);
}
const call = (calls, args, ctx) => {
  const last = init(calls).at(-1);
  return stack(ctx, last.op
    ? combine([last], last.op(unwrap(args), last, ctx))
    : combine(calls, unwrap(args))
  );
}
const stack = (ctx, calls) => new Proxy(ctx.target, {
  get: (_, key) => key == CALLS ? reduce(calls) : chain(calls, key, ctx),
  apply: (_, __, args) => ctx.process(args, calls) || call(calls, args, ctx)
});

const process = (api, call, el, atomic, prefix) => {
  const {
    sel='', group, important, media='',
    inline, animations={}, transition={}
  } = call;
  const style = {...call.style};
  const G = prefix + 'G';
  if (group == 'create') return api.addClass(el, G);
  
  style.transition = Object.entries(transition).map(([k, v]) =>
    k + ' ' + v
  ).join(',');
  style.animation = Object.values(animations).flat().map(v => {
    const str = v.keyframes.map(([ident, style]) =>
      ident + '% ' + styleStr(style, false)
    ).join('\n');
    const id = prefix + ID(str);
    api.addCSS(`@keyframes ${id} {\n${str}\n}`);
    return v.param + ' ' + id;
  }).join(',');
  
  for (const [k, v] of Object.entries(style)) if (!v) delete style[k];
  if (!Object.keys(style).length) return;
  if (inline) return api.addStyle(el, style);
  
  const entries = atomic
    ? Object.entries(style).map(([k, v]) => ({[k]: v}))
    : [style];
  for (const style of entries) {
    let str = styleStr(style, important);
    const cls = prefix + ID(media, group, sel, str);
    str = (
      group == 'ref'
      ? `.${G}${sel} :not(.${G}) .${cls}, .${G}${sel} > .${cls}`
      : `.${cls}${sel}`
    ) + str;
    api.addClass(el, cls);
    api.addCSS(media ? `@media ${media} {${str}}` : str);
  }
}

export const Adapter = (api) => (cfg) => {
  const {
    adopt=true, atomic=false,
    prefix='🇻', unit=[8,'px'], resolve={}, methods=v=>({})
  } = cfg;
  for (const [k, r] of Object.entries(resolve))
    resolve[k] = typeof r == 'function' ? r : v => r[v] ?? v;
  resolve.size = v => isNaN(+v) ? v : +v * unit[0] + unit[1];
  
  const [stylesheet, rules] = [new CSSStyleSheet, {}];
  if (adopt) document.adoptedStyleSheets.push(stylesheet);
  api.addCSS = (str) => rules[str] ??= stylesheet.rules[
    stylesheet.insertRule(str, stylesheet.cssRules.length)
  ];
  
  const v = stack({
    target: api.target,
    methods: methods(resolve),
    process: (args, calls) => {
      const el = api.element(args);
      return el && calls.map(call =>
        process(api, call, el, atomic, prefix));
    }
  }, []);
  return [v, stylesheet];
}
