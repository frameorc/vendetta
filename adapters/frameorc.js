import { Element, operator } from 'https://frameorc.github.io/src/dom.js';
import { Adapter } from '../src/index.js';
export default Adapter({
  target: operator(() => {}),
  element: (args) => args[1] instanceof Element && args[1],
  addClass: (el, cls) => (el.data.classes ??= new Set()).add(cls),
  addStyle: (el, style) => Object.assign(el.data.style ??= {}, style)
});
