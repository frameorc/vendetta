// vendetta core
// MIT License
// (c) 2023 Fedot Kryutchenko

const kebab = s => s.replaceAll(/[A-Z]/g, c => '-' + c.toLowerCase());
const selStr = str => str.replace(/[$A-Z].+?[^()]/g, key =>
  key[0] == '$'
  ? '::' + kebab(key.slice(1))
  : ':' + kebab(key).slice(1));
const styleStr = (style, important) => `{${
  Object.entries(style).map(([k, v]) =>
    kebab(k) + ': ' + v + (important ? ' !important' : '') + ';'
  ).join('')
}}`;

const CALLS = Symbol('VENDETTA_CALLS');
export const unwrap = v =>
  v && v[CALLS] || (
  typeof v == 'function' ? unwrap(v())
  : Array.isArray(v) ?
    Object.hasOwn(v[0], 'raw')
    ? v[0].flatMap((a, i) => !v[i+1] ? a : [a, unwrap(v[i+1])])
    : v.flatMap(unwrap)
  : [v]);

const init = calls => calls.length ? calls : [{
  sel: '', media: '', group: undefined, props: [], animations: []
}];
const combine = (calls1, calls2) => {
  const acc = {};
  for (const c1 of init(calls1)) for (const c2 of init(calls2)) {
    const s = [c1.sel, c2.sel].filter(v => v).join('.');
    const m = [c1.media, c2.media].filter(v => v).join(' and ');
    const i = c2.important;
    const g = c2.group ?? c1.group;
    const a = acc[s+m+i+g] ??= {sel: s, media: m, important: i, group: g};
    a.inline = c2.inline ?? c1.inline;
    (a.props ??= [...c1.props]).push(...c2.props);
    (a.animations ??= [...c1.animations]).push(...c2.animations);
  }
  return Object.values(acc);
}

const $ = (args, calls) => combine(calls, args);
$.combinator = true;
const Media = ([media, ...args], last) =>
  combine([{ ...last, media }], args);
const Style = (args, last) =>
  combine([{ ...last, inline: true }], args);
const Important = (args, last) =>
  combine([{ ...last, important: true }], args);
const Group = (args, last) =>
  combine([{ ...last, group: 'ref' }], args);
Group.chain = () => ({ group: 'create' });

const Transition = ([param, ...args], last) => args.map(arg =>
  combine([last], [{
    ...arg,
    props: arg.props.map(prop => ({...prop, transition: param}))
  }])[0]
);
const Animation = ([param, ...keyframes], last) => {
  const kf = keyframes.reduce((l, v) => (
    ('sel' in v ? l[0] : l).push(v)
  , l), [[]]);
  kf[0] = Object.fromEntries(kf[0].map((v, i) =>
    [i / (kf[0].length - 1) * 100, v]
  ));
  const anim = kf.filter(v => Object.keys(v).length).map(v => ({
    param,
    keyframes: Object.fromEntries(
      Object.entries(v).map(([k, v]) => [k, unwrap(v)[0].props])
    )
  }));
  return [{...last, animations: [...last.animations, ...anim]}];
}

const Property = (args, last) => {
  args = args.join('');
  args = /[()\[\]]/.test(args)
    ? [...args.matchAll(/(?:\S+\(.+?\))|(?:\S+\[.+?\])|(?:\S+)/g)].flat()
    : args.split(/\s+/);
  const props = [...last.props];
  props.findLast((prop, i) => !(!prop.args && (
    props[i] = { ...prop, args }
  )));
  return [{...last, props}];
}
Property.chain = (key, last) => ({ props: [...(last.props ?? []), {key}] });

const Selector = (args, last) => args.map(arg => ({
  ...arg,
  sel: last.sel + (arg.sel ? '(' + arg.sel + ')' : ''),
}));
Selector.chain = (key, last) => ({
  sel: (last.sel ? last.sel + '.' : '') + key
});


const operators = { $, Style, Important, Group, Media, Animation, Transition }
const chain = (calls, key) => {
  const last = init(calls).at(-1);
  const op = operators[key] ?? (/[a-z]/.test(key[0]) ? Property : Selector);
  if (op != Property && !op.combinator && last.props.length)
    throw new Error('not chainable');
  const newLast = {...last, op, ...(op.chain?.(key, last) ?? {})};
  return (op.combinator ? calls : []).concat(newLast);
}
const call = (calls, args) => {
  const last = init(calls).at(-1);
  if (args.length) args = unwrap(args);
  return !last.op ? calls.concat(args) :
    last.op(args, last.op.combinator ? calls : last);
}
const stack = (ctx, calls) => new Proxy(ctx.target, {
  get: (_, key) => key == CALLS ? combine([], calls) :
    stack(ctx, chain(calls, key)),
  apply: (_, __, args) => ctx.process(args, calls) ||
    stack(ctx, call(calls, args))
});

const ID = ((v={}, i=0) => (s) => v[s] ??= i++)();
const escape = ((pairs=Object.fromEntries(
  [...'  (⦗)⦘:᛬.ꓸ,‚[❲]❳|⼁'.matchAll(/../g)].map(v => v[0].split(''))
)) => str => CSS.escape(str.replaceAll(/./g, v => pairs[v] ?? v)))();

const argsc = f => 
  f.argsCount ??= String(f).match(/\.*\((.*)\)/)?.[1]?.split?.(',')?.length;
const process = (api, call, el, methods) => {
  const { group, important, media='', inline, props=[], animations=[] } = call;
  const G = '𝔾', M = '𝕄', A = '𝔸', T = '𝕋';
  const entries = [], transitions = [];
  const sel = call.sel, csssel = sel.split('.').map(selStr).join('');
  
  if (group == 'create') return api.addClass(el, G);
  
  for (const prop of props) {
    const style = {}, key = prop.key, transition = prop.transition;
    const args = argsc(methods[key]) > 1 ? prop.args : [];
    methods[key](style, ...(args ?? []));
    const cls = escape(key + '(' + args.join(' ') + ')');
    entries.push([cls, style]);
    if (transition) Object.keys(style)
      .forEach(v => transitions.push(kebab(v) + ' ' + transition));
  }
  if (transitions.length) {
    const transition = transitions.join(',');
    entries.push([escape(T + ID(transition)), { transition }]);
  }
  for (const {param, keyframes} of animations) {
    const str = Object.entries(keyframes).map(([ident, props]) => {
      const style = {};
      for (const {key, args} of props) methods[key](style, ...(args ?? []));
      return ident + '% ' + styleStr(style, false);
    }).join('\n');
    const id = escape(A + ID(str));
    api.addCSS('_' + id, `@keyframes ${id} {\n${str}\n}`);
    entries.push([id, { animation: param + ' ' + id }]);
  }
  
  for (let [cls, style] of entries) {
    if (inline) { api.addStyle(el, style); continue; }
    cls = escape(
      (media ? M + ID(media) + ':' : '') +
      (group ? G + ':' : '') +
      (sel ? sel + '.' : '')
    ) + cls;
    style = (
      group == 'ref'
      ? `.${G}${csssel} :not(.${G}) .${cls}, .${G}${csssel} > .${cls}`
      : `.${cls}${csssel}`
    ) + styleStr(style, important);
    api.addClass(el, cls);
    api.addCSS(cls, media ? `@media ${media} {${style}}` : style);
  }
}

export const Adapter = (api) => (methods) => {
  const [stylesheet, rules] = [new CSSStyleSheet, {}];
  document.adoptedStyleSheets.push(stylesheet);
  
  api.addCSS ??= (id, str) => rules[id] ??= stylesheet.rules[
    stylesheet.insertRule(str, stylesheet.cssRules.length)
  ];
  
  const v = stack({
    target: api.target,
    process: (args, calls) => {
      const el = api.element(args);
      if (!el) return false;
      for (const call of calls)
        process(api, call, el, methods);
      return true;
    }
  }, []);
  return [v, stylesheet];
}
