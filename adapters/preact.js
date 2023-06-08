import { Adapter } from '../src/index.js';

const MARK = Symbol('NODE');
const traverse = (node) => {
  if (node?.[MARK]) return node;
  if (Array.isArray(node)) return node.map(traverse);
  if (typeof node == 'function') return traverse(node());
  if (node == null || typeof node != 'object') return node;
  
  const { type, props } = node;
  const cls = typeof type === 'function' &&
    type.prototype?.constructor === type;
  const fn = typeof type === 'function' && !cls;
  const prim = !cls && !fn;
  
  if (cls) {
    node.type = function () {
      return Reflect.construct(type, arguments, node.type)
    }
    Reflect.setPrototypeOf(node.type.prototype, node.type.prototype)
    Reflect.setPrototypeOf(node.type, type)
    node.type.prototype.render = function () {
      return traverse(type.prototype.render.call(this, ...arguments));
    }
  }
  if (fn) {
    node.type = () => traverse(type(props));
  }
  if (prim) {
    let ch = node.props.children;
    if (ch) {
      if (Array.isArray(ch)) ch = ch.map(traverse);
      else ch = [traverse(ch)];
    }
    if (Array.isArray(ch)) {
      for (const c of ch) if (c?.[MARK]) c(MARK, node);
    }
    node.props.children = ch;
  }
  
  return node;
}

export const VendettaRoot = fn => () => traverse(fn);

export default Adapter({
  target: Object.assign(() => {}, {[MARK]: true}),
  element: (args) => typeof args[0] == 'symbol' && args[0] == MARK && args[1],
  addClass: (el, cls) => {
    const p = el.props;
    p.class = (p.class ? p.class + ' ' : '') + cls;
  },
  addStyle: (el, style) => {
    Object.assign(el.props.style ??= {}, style);
  }
});
