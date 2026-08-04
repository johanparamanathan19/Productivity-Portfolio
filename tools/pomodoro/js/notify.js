/**
 * Desktop notifications. Every entry point is a no-op when the browser
 * lacks support or the user has not granted permission.
 */

const ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"' +
  '%3E%3Ctext y=".9em" font-size="90"%3E🌱%3C/text%3E%3C/svg%3E';

const supported = () => 'Notification' in window;

/** Ask once, and only if the user has not already decided. */
export function requestPermission() {
  if (supported() && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/** @param {string} body */
export function notify(body) {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    new Notification('Grove', { body, icon: ICON, silent: true });
  } catch {
    /* some browsers block the constructor outside a service worker */
  }
}
