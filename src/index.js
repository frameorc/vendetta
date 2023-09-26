const ID = ((r={}, i={}) => (t, v) => {
  return r[t+v] ??= i[t] = (i[t] ??= -1) + 1;
})();
const chars = Object.fromEntries([...
  `  (⦗)⦘:᛬.ꓸ,‚[❲]❳|⼁#＃<﹤>﹥{❴}❵"“'‘%％!ǃ`.matchAll(/../g)
].map(v => v[0].split('')));
const escape = str => CSS.escape(str.replaceAll(/./g, v => chars[v] ?? v));
const selectorTmpl = (sel='', val='') => (
  typeof sel == 'function' ? sel(val)
  : sel.includes('&') ? sel.replaceAll('&', val)
  : val + sel
);
const splitSelector = str => [str];
const kebab = s => s.replaceAll(/[A-Z]/g, c => '-' + c.toLowerCase());
const styleStr = (style, important) => `{${
  Object.entries(style).map(([k, v]) =>
    kebab(k) + ': ' + v + (important ? ' !important' : '') + ';'
  ).join('')
}}`;

const unwrap = f => typeof f == 'function' ? unwrap(f()) : f;
class Node {
  constructor(data) {
    this.updates = {};
    for (const [k, v] of Object.entries({
      selector: '',
      media: '',
      important: false,
      inline: false,
      classname: null,
      rules: null,
      style: null
    })) {
      const val = data[k] ?? v;
      if (typeof val == 'function') {
        this.updates[k] = val;
        this[k] = unwrap(val);
      } else if (val) {
        this[k] = val;
      }
    }
  }
  recalculate() {
    for (const [k, f] of Object.entries(this.updates)) this[k] = unwrap(f);
  }
  css() {
    const cls = escape([
      this.media && '𝕄(' + this.media + ')',
      this.selector && '𝕊(' + this.selector + ')',
      this.classname,
      this.important && 'ǃ'
    ].filter(v => v).join(''));
    const sel = selectorTmpl(this.selector, '.' + cls);
    const str = sel + styleStr(this.style, this.important);
    const rules = [
      ...(this.rules ?? []),
      this.media ? `@media ${this.media} {${str}}` : str
    ];
    return { cls, rules };
  }
}

const StyleNode = (...args) => new Node(
  args.length == 1
  ? { classname: 'CSS(' + JSON.stringify(args[0]) + ')', style: args[0] }
  : { classname: args[0], style: args[1] }
);
const MethodNode = (methods, name, args) => new Node({
  classname: name + '(' + args.join(',') + ')',
  style: () => methods[name](...args)
});

const toNodes = obj =>
  Array.isArray(obj) ? obj.flatMap(toNodes)
  : typeof obj == 'function' ? toNodes(obj())
  : obj instanceof Node ? obj
  : StyleNode(obj);
  
const separateStyle = {
  transform: ''
}
const combinedStyle = nodes => nodes.reduce((obj, node) => {
  const style = node.updates.style?.() ?? node.style ?? {};
  for (const [k, v] of Object.entries(style)) {
    const sep = separateStyle[k];
    obj[k] = sep !== undefined
      ? [obj[k], v].filter(v => v).join(sep)
      : v;
  }
  return obj;
}, {});

const operators = {
  Sel: (selStr, ...args) => splitSelector(selStr).flatMap(selStr =>
    args.flatMap(toNodes).map(node => new Node({
      ...node,
      selector: node.selector ? selectorTmpl(selStr, node.selector) : selStr
    }))
  ),
  Media: (queryStr, ...args) => args.flatMap(toNodes).map(node => new Node({
    ...node,
    media: node.media ? node.media + ' and ' + queryStr : queryStr
  })),
  Important: (...args) => args.flatMap(toNodes).map(node => new Node({
    ...node,
    important: true
  })),
  Inline: (...args) => args.flatMap(toNodes).map(node => new Node({
    ...node,
    inline: true
  })),
  Transition: (param, ...args) => {
    const nodes = toNodes(args);
    const keys = () => Object.keys(combinedStyle(nodes));
    return nodes.concat(new Node({
      classname: () => '𝕋(' + ID('transition', param + keys().join(',')) + ')',
      style: () => ({ transition: keys().map(k => param + ' ' + k).join(',') })
    }));
  },
  Animation: (param, keyframes) => {
    const str = () =>
      Object.entries(keyframes).map(([ident, nodes]) => {
        const style = combinedStyle(toNodes(nodes));
        return ident + '% ' + styleStr(style, false);
      }).join('\n');
    const kfId = ID('keyframes', str());
    const aId = ID('animation', param + kfId)
    return [new Node({
      classname: () => '𝔸(' + aId + ')',
      rules: () => [`@keyframes 𝔸${kfId} {\n${str()}\n}`],
      style: () => ({ animation: param + ' 𝔸' + kfId })
    })];
  },
}

const Stack = (wrap, methods) => {
  const methodNames = Object.keys(methods);
  for (const name of methodNames) {
    if (typeof name == 'symbol' || name == 'lenght' || +name+'' == name)
      throw new Error(`Not allowed method: "${name}"`);
    if (name[0].toLowerCase() != name[0])
      throw new Error('Method name should start with a lowercase character' +
        `, got "${name}"`);
  }
  const stack = (nodes, props) => {
    nodes = toNodes(nodes);
    
    const style = (...args) => wrap([StyleNode(...args)]);
    const operator = (func) => (...args) => wrap(func(...args));
    const method = (...args) => stack(
      nodes.concat(props.map(name => MethodNode(methods, name, args))),
      []
    );
    const res = props.length ? method : !nodes.length ? style : wrap(nodes);
    
    if (nodes.length == 0 && props.length == 0) {
      for (const [name, func] of Object.entries(operators))
        res[name] = operator(func);
    }
    
    for (const name of methodNames) Object.defineProperty(res, name, {
      configurable: false,
      enumerable: true,
      get: () => stack(nodes, props.concat(name))
    });
    
    return res;
  }
  return stack([], []);
}

const Processor = ({ addStyle, addClass }) => {
  const stylesheet = new CSSStyleSheet;
  document.adoptedStyleSheets.push(stylesheet);
  
  const processedRules = new Set();
  const insertRule = rule => {
    if (processedRules.has(rule)) return;
    processedRules.add(rule);
    stylesheet.insertRule(rule, stylesheet.cssRules.length);
  }
  
  const processedNodes = {};
  const process = (elem, nodes) => {
    //console.log('\n\nprocess elem', { elem, nodes });
    for (const node of nodes) {
      const { cls, rules } = node.css();
      if (node.inline) {
        addStyle(elem, node.style);
      } else {
        if (!processedNodes[cls]) {
          for (const rule of rules) insertRule(rule);
          processedNodes[cls] = node
        }
        addClass(elem, cls);
      }
    }
  }
  const recalculate = () => {
    stylesheet.replaceSync('');
    processedRules.clear();
    for (const node of Object.values(processedNodes)) {
      node.recalculate();
      for (const rule of node.css().rules) insertRule(rule);
    }
  }
  
  return { process, recalculate, stylesheet }
}

export const Adapter = ({ wrap, addClass, addStyle }) => methods => {
  const { process, recalculate, stylesheet } = Processor({ addStyle, addClass });
  const wrap_ = (nodes) => wrap(nodes, process);
  const v = Stack(wrap_, methods);
  return { v, recalculate, stylesheet };
}
