// store.js – simple global state manager with change detection
const listeners = new Set();
let _state = {
  tasks: [],
  lastVisible: null,
  isLoading: false,
  pagination: { pageSize: 20, hasMore: true }
};
let _prevHash = '';

function hashState(state) {
  // Quick hash of tasks array for change detection
  const tasks = state.tasks || [];
  let h = 0;
  for (let i = 0; i < Math.min(tasks.length, 200); i++) {
    const t = tasks[i];
    h = ((h << 5) - h) + (t.id ? t.id.charCodeAt(0) || 0 : 0);
    h = h & h;
  }
  return h + '|' + tasks.length;
}

export const store = {
  get() { return _state; },
  set(patch) {
    const newState = { ..._state, ...patch };
    const newHash = hashState(newState);
    if (newHash === _prevHash) {
      // No meaningful change, skip notification
      _state = newState;
      return;
    }
    _prevHash = newHash;
    _state = newState;
    listeners.forEach(cb => cb(_state));
  },
  subscribe(cb) { listeners.add(cb); },
  unsubscribe(cb) { listeners.delete(cb); },
  // Reset hash (call after full data reload)
  resetHash() { _prevHash = ''; }
};
