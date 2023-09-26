import { Builder } from 'https://cdn.jsdelivr.net/gh/frameorc/frameorc@69af49aba3bf2d5f373eb0b128a923e827483b36/src/builder.js';
import { operator } from 'https://cdn.jsdelivr.net/gh/frameorc/frameorc@69af49aba3bf2d5f373eb0b128a923e827483b36/src/dom.js';
import { Adapter } from '../src/index.js';
export default Adapter({
  wrap: (nodes, process) => Object.assign(() => nodes, {
    [Builder.symbol]: {
      effect: () => operator((elem) => process(elem, nodes)),
      tasks: []
    }
  }),
  addClass: (el, cls) => (el.data.classes ??= new Set()).add(cls),
  addStyle: (el, style) => Object.assign(el.data.style ??= {}, style)
});

