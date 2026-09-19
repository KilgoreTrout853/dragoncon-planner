/* The bus: how a module below the shell - a view, the sheet, loading - asks
   for the whole page to be drawn again without importing the shell, which
   imports them. One call goes over it, render(), and it is a plain
   call-through: requestRender() calls the registered function then and there
   and returns when it has drawn, so what follows it - a scroll back to the
   top, a measurement - still follows the draw. boot() registers render()
   before it registers anything else; asking before that is a bug, and
   throws. The partial redraws - the mini-bar, the minute ticks, Explore's
   sections, the queued Browse draw - are not the bus's: the shell and
   dispatch import those from the views, never the reverse. */
let renderer = null;
function setRenderer(fn) { renderer = fn; }
function requestRender() {
  if (!renderer) throw new Error("requestRender() before setRenderer(): boot() has not run");
  renderer();
}

export { requestRender, setRenderer };
