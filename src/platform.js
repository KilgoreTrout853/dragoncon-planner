/* What the device is, as far as the page needs to know: an iPhone or iPad,
   and whether it was opened from the home screen. IS_IOS is decided once, as
   the module is imported; isStandalone() asks each time it is called. */

const IS_IOS = /iP(hone|ad|od)/.test(navigator.platform)
  || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1);

function isStandalone() {
  return !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
}

export { IS_IOS, isStandalone };
