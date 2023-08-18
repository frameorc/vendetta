import { c, operator, body, hook, attach, append, rRef, Element } from './frameorc-dom.js';

const vnodeProxyToJson = vnode => {
  const view = new Element('div', {}, []);
  append(vnode, view, {});
  return view.children[0];
}

let i = 0;
let state = []; // root state

const Val = (arg) => {
  const j = i++;
  state[j] ??= arg;
  return body.Ref(state, j);
}

const Component_ = (render, is) => {
  let sel = 'div';
  return (...args) => {
    const updateNode = (vnode) => {
      const [prevI, prevState] = [i, state];
      [i, state] = [0, vnode.data.state];
      const newVnode = vnodeProxyToJson(// костыль
        render(...args)(wrapper())
      );
      Object.assign(vnode.data, newVnode.data, { state });
      [i, state] = [prevI, prevState];
      vnode.elm = newVnode.elm;
      vnode.children = newVnode.children;
      vnode.text = newVnode.text;
      vnode.key = newVnode.key;
      sel = vnode.sel = newVnode.sel;
      // console.log(">", vnode)
    }
    
    const wrapper = (vnode) => [
      operator(el => el.data.is = is),
      hook
        .init(vnode => {
          // console.log('init')
          vnode.data.state = [];
          updateNode(vnode);
        })
        .prepatch((oldVnode, vnode) => {
          vnode.data.state = oldVnode.data.state;
          updateNode(vnode);
        }),
    ];
    return c(wrapper(), operator(el => el.sel = sel));
  }
}

const Component = (render) => Component_(render, render);
Component.child = render => Component_(render, render.toString())();

export { Component, Val };
