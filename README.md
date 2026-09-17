# Smooth Scroll (smooth_scroll)

Eased scrolling for any scrollable element, and for the page itself. Nothing is wrapped, moved or transformed: the element's own scroll position is animated, so clicks, sticky elements, anchors and lazy loading keep working.

<p align="center">
 <a href="https://teomandeniz.github.io/SMOOTH_SCROLL_JS/"><img src="https://img.shields.io/badge/Live_Demo-Open-2F5BFF?style=for-the-badge" alt="Live Demo"/></a>
</p>

<p align="center">
 <img width="400PX" src="https://raw.githubusercontent.com/TeomanDeniz/TeomanDeniz/main/images/repo_projects/SMOOTH_SCROLL.gif">
</p>

## Features

* No wrapper element and no CSS to write. Mark elements with one attribute, or pass them in JavaScript.
* Vertical and horizontal, mouse wheel, trackpad, keyboard, scrollbar and touch.
* Eases out and truly lands, instead of creeping toward the target for seconds.
* The same feel at 60 Hz, 144 Hz or 240 Hz.
* Nested scrolling behaves like the browser's: an inner box scrolls first, then the one around it takes over at its edge.
* Anchor links glide instead of jumping.
* Picks up elements added to the page later.
* Sleeps when nothing moves, so no work happens between scrolls.

## Install

Classic script:

```html
<script src="smooth_scroll.js"></script>
<script>
	smooth_scroll.start();
</script>
```

ES module (keep `smooth_scroll.js` next to it):

```js
import smooth_scroll from "./smooth_scroll.mjs";

smooth_scroll.start();
```

The script can be placed anywhere, including `<head>`.

## Usage

With no options, every element carrying the attribute becomes smooth. Put it on `<body>` for the whole page:

```html
<body data-smooth-scroll>
	<div class="list" data-smooth-scroll="0.1">...</div>
</body>
```

The attribute value is optional. A value with `s` is a duration (`"1.6s"`), a plain number is a friction (`"0.08"`).

Or choose the elements yourself:

```js
smooth_scroll.start({targets: ".list, .gallery", duration: 0.8});
smooth_scroll.start({targets: window});
smooth_scroll.start({targets: [document.querySelector(".list"), window]});
```

### Options

| Option           | Default             | Meaning                                                                 |
| ---------------- | ------------------- | ----------------------------------------------------------------------- |
| `targets`        | `[data-smooth-scroll]` | Element, `window`, selector, array or NodeList.                      |
| `duration`       | `1`                 | Seconds a scroll takes to finish, with an ease-out curve. This is the default motion. |
| `easing`         | ease out            | `function (progress) { return (eased); }`, from `0` to `1`.             |
| `friction`       | unset               | Use the old constant-catch-up motion instead of a duration. Same scale as before: `0.04` feels like `0.04`. |
| `touch`          | `true`              | Smooth dragging and inertia on touch screens.                          |
| `keyboard`       | `true`              | Arrow keys, Page Up and Page Down, Home, End and Space.                |
| `anchors`        | `true`              | `#` links glide to their target.                                       |
| `watch_dom`      | `true`              | Pick up elements with the attribute added later.                       |
| `reduced_motion` | `"respect"`         | `"ignore"` keeps easing for users who asked for reduced motion.        |

### Controlling it later

```js
const scroll = smooth_scroll.start();

scroll.add(element, {friction: 0.1});
scroll.remove(element);
scroll.set_duration(0.8);             // everything
scroll.set_duration(0.8, element);    // one element
scroll.set_easing(function (progress) {return (progress * progress);});
scroll.set_friction(0.08);            // switch to the old motion
scroll.scroll_to("#section", {offset: -80});
scroll.scroll_to(1200);
scroll.scroll_to(element, {immediate: true});
scroll.refresh();
scroll.stop();
scroll.elements;   // the elements being smoothed
scroll.running;
```

`scroll_to` picks the smallest smooth element that contains the target, so it works for the page and for boxes.

## How it works

Wheel, key and touch events are taken over, and each one moves a target position and restarts a tween from wherever the scroll currently is. Every frame, the element's real `scrollTop` and `scrollLeft` follow that tween along an ease-out curve, so the scroll slows down and lands exactly on time, whatever the frame rate. The loop stops as soon as the target is reached.

With `friction` instead of `duration`, each frame moves a fraction of the remaining distance. That's the motion of the first version: it never quite arrives, so a flick keeps drifting for about three seconds.

Because the real scroll position is what moves, everything the browser derives from it stays correct, and the element's own scrollbar keeps working. Dragging the scrollbar, `scrollIntoView()`, and anything else that scrolls the element are noticed and adopted as the new position.

## Limitations

* Scrollbar dragging is not eased, because it's a direct manipulation. Whatever it does becomes the new position.
* Scroll-linked effects made with CSS `scroll-timeline` stay in step, but expect the eased position rather than the raw wheel.

## Upgrading from `SMOOTH_SCROLL()`

| Before                                     | Now                                                         |
| ------------------------------------------ | ------------------------------------------------------------ |
| `SMOOTH_SCROLL(element)`                   | `smooth_scroll.start({targets: element})`, or the attribute |
| `SMOOTH_SCROLL(element, 0.08)`             | `data-smooth-scroll="0.08"`, or `{friction: 0.08}`          |
| The long drifting tail                     | Gone by default. Use `duration` to set how long a scroll takes |
| `<slider_container>` and its CSS           | Not needed anymore                                          |
| `position: absolute` on the inner wrapper  | Not needed anymore                                          |
| Reloading the page to stop it              | `scroll.stop()`                                             |
