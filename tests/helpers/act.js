/* What a reader does to the page, for the page tests: the same three
   gestures the smoke harness spelled out longhand each time. */

/* Type into a box: set the value, fire the input event the app listens for. */
export function typeInto(box, value) {
  box.value = value;
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

/* A click that bubbles from an element with no click() of its own (SVG). */
export function tap(el) {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/* A touch event as the app reads one: touches[0].clientX / clientY. jsdom has
   no Touch constructor, and the handlers look at nothing else. */
export function touch(el, type, point, init = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true, ...init });
  event.touches = point ? [{ clientX: point.x || 0, clientY: point.y || 0 }] : [];
  el.dispatchEvent(event);
  return event;
}

/* Collects what changes under a container while `during` runs. A
   MutationObserver delivers in a microtask, so the records are taken by hand. */
export function mutationsDuring(container, during) {
  const seen = [];
  const observer = new MutationObserver(records => seen.push(...records));
  observer.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
  during();
  seen.push(...observer.takeRecords());
  observer.disconnect();
  return seen;
}
