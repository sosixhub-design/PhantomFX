/*
  PhantomFX data store
  ---------------------
  TEMPORARY: this uses localStorage so admin.html and nav5.html can share
  data right now, with zero backend, as long as they're on the same domain
  (e.g. both on phantomhub.pages.dev). It is NOT a real multi-user backend —
  uploads only show up in the browser that made them.

  When you're ready to wire up Cloudflare (Worker + D1 for the item list,
  R2 for thumbnails), replace the three functions below with fetch() calls
  to your Worker API. Nothing else in nav5.html or admin.html needs to
  change, since they only ever call PhantomStore.getItems / saveItem /
  deleteItem.

    Example swap:
      async function getItems() {
        const res = await fetch(API_BASE + '/api/items');
        return res.json();
      }
*/

const PhantomStore = {
  KEY: 'phantomfx_items_v1',

  getItems() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : this._seed();
    } catch (e) {
      return this._seed();
    }
  },

  saveItem(item) {
    const items = this.getItems();
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = item; else items.push(item);
    localStorage.setItem(this.KEY, JSON.stringify(items));
    return items;
  },

  deleteItem(id) {
    const items = this.getItems().filter(i => i.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(items));
    return items;
  },

  // One example item per category so the site isn't empty on first load.
  _seed() {
    const seeded = [
      {
        id: 1,
        category: 'assets',
        title: 'Dust Dissolve',
        username: 'you',
        type: 'Free',
        views: 0,
        thumbnail: '',
        effectType: 'dustDissolve',
        params: { particleCount: 200, speed: 6, dustColor: '#cccccc', coverage: 45 }
      },
      {
        id: 2,
        category: 'sfx',
        title: 'Echo Tail',
        username: 'you',
        type: 'Free',
        views: 0,
        thumbnail: '',
        effectType: 'echoDelay',
        params: { delayTime: 0.3, feedback: 0.4, mix: 40 }
      }
    ];
    localStorage.setItem(this.KEY, JSON.stringify(seeded));
    return seeded;
  }
};
