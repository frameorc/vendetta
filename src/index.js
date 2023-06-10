// vendetta core
// MIT License
// (c) 2023 Fedot Kryutchenko

const kebab = s => s.replaceAll(/[A-Z]/g, c => '-' + c.toLowerCase());
const selStr = str => str.replace(/[$A-Z].+?[^()]/g, key =>
  key[0] == '$'
  ? '::' + kebab(key.slice(1))
  : ':' + kebab(key).slice(1));
const styleStr = (style, important) => `{${
  Object.entries(style).map(([k, v]) => k == '$cls' ? '' :
    kebab(k) + ': ' + v + (important ? ' !important' : '') + ';'
  ).join('')
}}`;

const CALLS = Symbol('VENDETTA_CALLS');
const Call = () => ({
  op: concat, name: '', sel: '', media: '', props: [], process: []
});
const PlainObjectCSS = v => [{
  process: [(methods) => () => ({
    style: v,
    cls: v.$cls ?? 'ℂ𝕊𝕊' + '(' + JSON.stringify(v) + ')'
  })]
}];

export const unwrap = v =>
  v && v[CALLS] || (
  typeof v == 'function' ? unwrap(v())
  : Array.isArray(v) ?
    v[0] && Object.hasOwn(v[0], 'raw')
    ? [v[0].flatMap((a, i) => !v[i+1] ? a : [a, unwrap(v[i+1])]).join('')]
    : v.flatMap(unwrap)
  : v && typeof v == 'object' ? PlainObjectCSS(v)
  : v);

const combine = (calls1, calls2) => {
  const acc = {};
  if (!calls1.length) return calls2;
  if (!calls2.length) return calls1;
  for (const c1 of calls1) for (const c2 of calls2) {
    const s = [c1.sel, c2.sel].filter(v => v).join('');
    const n = [c1.name, c2.name].filter(v => v).join('.');
    const m = [c1.media, c2.media].filter(v => v).join(' and ');
    const i = c2.important ?? c1.important;
    const a = acc[n+i+m] ??= {sel: s, media: m, important: i, name: n};
    a.inline = c2.inline ?? c1.inline;
    (a.props ??= [...c1.props]).push(...c2.props);
    (a.process ??= [...c1.process]).push(...c2.process);
  }
  return Object.values(acc);
}

const concat = (args, calls) => calls.concat(unwrap(args));
concat.combinator = true;
const $ = (args, calls) => combine(calls.slice(0, -1), unwrap(args));
$.combinator = true;
const Style = (args, last) =>
  combine([{ ...last, inline: true }], unwrap(args));
const Media = ([media, ...args], last) =>
  combine([{ ...last, name: '𝕄' + ID(media), media }], unwrap(args));
const Important = (args, last) =>
  combine([{ ...last, name: '𝕀', important: true }], unwrap(args));
const Group = (args, last) =>
  combine([{ ...last, name: '𝔾', process: last.process.slice(0, -1) }],
    unwrap(args).map(arg => ({
      ...arg,
      sel: `.𝔾${arg.sel} :not(.𝔾) &, .𝔾${arg.sel} > &`
    }))
  );
Group.chain = () => ({ process: [(method) => () => ({ cls: '𝔾' })] });

const Transition = ([param, ...args], last) => unwrap(args).map(arg =>
  combine([last], [{
    ...arg,
    process: arg.process.concat((methods) => () => {
      const transition = arg.process.flatMap(func => {
        const style = func(methods)().style ?? {};
        return Object.keys(style).map(k => kebab(k) + ' ' + param);
      }).join(',');
      return {
        style: { transition },
        cls: escape('𝕋' + ID(transition)),
      }
    })
  }])[0]
);
const Animation = ([param, keyframes], last) => [{
  ...last,
  process: last.process.concat((methods, ctx) => {
    const str = Object.entries(keyframes).map(([ident, arg]) => {
      const style = {};
      for (const func of unwrap(arg)[0].process)
        Object.assign(style, func(methods)().style ?? {});
      return ident + '% ' + styleStr(style, false);
    }).join('\n');

    const entry = ctx.animations ??= { list: [], css: [], res: {} };
    const id = escape('𝔸' + ID(str));
    entry.css.push(`@keyframes ${id} {\n${str}\n}`);
    entry.list.push(param + ' ' + id);
    return () => Object.assign(entry.res, {
      css: entry.css,
      style: { animation: entry.list.join(',') },
      cls: escape('𝔸' + ID(entry.list))
    });
  })
}];

const splitPropArg = arg =>
  /['"()\[\]]/.test(arg)
  ? [...arg.matchAll(
      /(?:\S*\'.+?\')|(?:\S*\".+?\")|(?:\S*\(.+?\))|(?:\S*\[.+?\])|(?:\S+)/g
    )].flat()
  : arg.split(/\s+/);
const Property = (args, last) => (
  args = unwrap(args).flatMap(arg =>
    typeof arg == 'object' ? [arg] : splitPropArg(String(arg))
  ),
  [{...last, props: [],
    process: last.process.concat(
      last.props.map((key) => (methods) => () => ({
        style: methods[key](...(args ?? [])),
        cls: key + '(' + (argsCount(methods[key]) > 0 ? args.join(' ') : '') + ')'
      }))
    )
  }]
);
Property.chain = (key, last) => ({ props: (last.props ?? []).concat(key) });

const Selector = (args, last) => unwrap(args).map(arg => ({
  ...arg,
  name: last.name + (arg.name ? '(' + arg.name + ')' : ''),
  sel: last.sel + (arg.sel ? '(' + selStr(arg.sel) + ')' : '')
}));
Selector.chain = (key, last) => ({
  name: (last.name ? last.name + '.' : '') + key,
  sel: (last.sel ? last.sel : '') + selStr(key),
});

const operators = {
  $, Style, Important, Group, Media, Animation, Transition
}
const chain = (calls, key) => {
  const last = calls.at(-1) ?? Call();
  const op = operators[key] ?? (/[a-z]/.test(key[0]) ? Property : Selector);
  if (op != Property && !op.combinator && last.props.length)
    throw new Error('not chainable');
  const curr = Object.assign({...last, op }, op.chain?.(key, last));
  return (op.combinator ? calls : []).concat(curr);
}

const call = (calls, args) => {
  const last = calls.at(-1) ?? Call();
  calls = last.op(args, last.op.combinator ? calls : last);
  return (calls.at(-1).op = concat, calls);
}
const stack = (ctx, calls) => new Proxy(ctx.target, {
  get: (_, key) => key == CALLS ? combine([], calls)
    : typeof key == 'symbol' ? ctx.target[key]
    : stack(ctx, chain(calls, key)),
  apply: (_, __, args) => ctx.process(args, calls) ||
    stack(ctx, call(calls, args))
});

const ID = ((v={}, i=0) => (s) => v[s] ??= i++)();
const escape = ((pairs=Object.fromEntries(
  [...`  (⦗)⦘:᛬.ꓸ,‚[❲]❳|⼁#＃<﹤>﹥{❴}❵"“'‘%％`.matchAll(/../g)]
    .map(v => v[0].split(''))
)) => str => CSS.escape(str.replaceAll(/./g, v => pairs[v] ?? v)))();

const argsCount = f => f.argsCount ??=
  String(f).match(/\.*?\((.*?)\)/)?.[1]?.split?.(',').filter(v => v)?.length;
const processCall = (call, methods) => {
  const { name, sel='', important, inline, media='', process=[] } = call;
  const ctx = {};
  return process.map(fn => fn(methods, ctx)).map(res => () => {
    let { cls, style, css=[] } = res();
    cls = escape((name ? name + '.' : '') + cls);
    if (style) {
      const sel1 = sel.includes('&')
        ? sel.replaceAll('&', '.' + escape(cls))
        : '.' + escape(cls) + sel;
      const style1 = sel1 + styleStr(style, important);
      css = css.concat(media ? `@media ${media} {${style1}}` : style1);
    }
    return { cls, css, inlineStyle: inline ? style : null };
  });
}

export const Adapter = (api) => (methods) => {
  const stylesheet = new CSSStyleSheet;
  document.adoptedStyleSheets.push(stylesheet);
  const addRule = str => stylesheet.insertRule(str, stylesheet.cssRules.length);

  const updates = {};
  const process = (args, calls) => {
    const el = api.element(args);
    if (!el) return false;
    const updatesList = calls.flatMap(call => processCall(call, methods));
    for (const update of updatesList) {
      const { cls, css, inlineStyle } = update();
      if (!updates[cls] && css) {
        updates[cls] = update;
        css.forEach(addRule);
      }
      if (inlineStyle) api.addStyle(el, inlineStyle);
      else api.addClass(el, cls);
    }
    return true;
  }
  
  const recalculate = () => {
    stylesheet.replace('');
    Object.values(updates).flatMap(f => f().css).forEach(addRule);
  }
  
  const v = stack({ target: api.target, process }, []);
  return {v, stylesheet, recalculate};
}
