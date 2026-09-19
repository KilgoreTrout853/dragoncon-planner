/* The two places the app keeps anything: localStorage for what should outlive
   the tab (picks, follows, settings), sessionStorage for what should not (the
   simulated clock). Either can throw - private mode, a full quota, storage
   switched off - and neither may break the page, so a read falls back and a
   write is dropped. */

function loadJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

const readSession = key => { try { return sessionStorage.getItem(key); } catch (e) { return null; } };
const writeSession = (key, value) => { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch (e) {} };

export { loadJSON, saveJSON, readSession, writeSession };
