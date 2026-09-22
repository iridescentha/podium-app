// DOM tiruan seadanya: cukup untuk menguji struktur lintasan waktu, penempatan
// dalam persen, serta interaksi kepala pemutar (klik, seret, papan ketik).
class El {
  constructor(tag, ns) {
    this.tagName = tag; this.ns = ns; this.children = []; this.style = {}; this.dataset = {};
    this._teks = ''; this.attrs = {}; this.className = ''; this.listeners = {};
    this.disabled = false; this.tabIndex = -1; this.type = '';
    this.classList = {
      add: (k) => { this.className = (this.className ? this.className + ' ' : '') + k; },
      contains: (k) => this.kelas.split(' ').includes(k)
    };
  }
  appendChild(c) {
    if (c && c.__fragment) { c.children.forEach(x => this.children.push(x)); return c; }
    this.children.push(c); return c;
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(nama, fn) { (this.listeners[nama] = this.listeners[nama] || []).push(fn); }
  picu(nama, event = {}) { (this.listeners[nama] || []).forEach(fn => fn({ preventDefault(){}, ...event })); }
  focus() {}
  setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
  scrollIntoView() {}
  // Lintasan dianggap selebar 1000 piksel mulai dari x=0
  getBoundingClientRect() { return { left: 0, width: 1000, top: 0, height: 100 }; }
  set textContent(v) { this._teks = v; this.children = []; }
  get textContent() { return this._teks + this.children.map(c => c.textContent).join(''); }
  set innerHTML(v) { if (v === '') this.children = []; }
  get kelas() { return String(this.className || this.attrs.class || ''); }
  semua(pred, hasil = []) { for (const c of this.children) { if (pred(c)) hasil.push(c); c.semua(pred, hasil); } return hasil; }
  denganKelas(k) { return this.semua(c => c.kelas.split(' ').includes(k)); }
  querySelector(sel) { const k = sel.replace('.', ''); return this.denganKelas(k)[0] || null; }
}
class Fragment extends El { constructor() { super('#fragment'); this.__fragment = true; } }
globalThis.document = {
  createElement: (t) => new El(t),
  createElementNS: (ns, t) => new El(t, ns),
  createDocumentFragment: () => new Fragment(),
  createTextNode: (t) => { const e = new El('#text'); e.textContent = t; return e; }
};
export { El };
