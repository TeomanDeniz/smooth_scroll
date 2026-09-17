/******************************************************************************\
# JS - smooth_scroll                             #       Maximum Tension       #
################################################################################
#                                                #      -__            __-     #
# Teoman Deniz                                   #  :    :!1!-_    _-!1!:    : #
# maximum-tension.com                            #  ::                      :: #
#                                                #  :!:    : :: : :  :  ::::!: #
# +.....................++.....................+ #   :!:: :!:!1:!:!::1:::!!!:  #
# : C - Maximum Tension :: Create - 2024/11/22 : #   ::!::!!1001010!:!11!!::   #
# :---------------------::---------------------: #   :!1!!11000000000011!!:    #
# : License - MIT       :: Update - 2026/09/17 : #    ::::!!!1!!1!!!1!!!::     #
# +.....................++.....................+ #       ::::!::!:::!::::      #
\******************************************************************************/

/*
** Smooth scrolling for any scrollable element, and for the page itself.
**
** Nothing is wrapped, moved or transformed: the element's own scroll position
** is eased, so clicks, sticky elements, anchors and lazy loading keep working.
**
** Works as a classic <script> (creates the global `smooth_scroll`), and can
** be imported as an ES module through `smooth_scroll.mjs`.
*/

(function (global_object)
{
	"use strict";

	const	ATTRIBUTE = "data-smooth-scroll";
	const	DEFAULT_DURATION = 1;
	const	DEFAULT_FRICTION = 0.04;
	const	WHEEL_LINE = 40;
	const	KEY_STEP = 60;
	const	SYNC_TOLERANCE = 2;
	const	STOP_DISTANCE = 0.1;
	const	MAX_FRAME_TIME = 0.05;
	const	KEY_STEPS = {ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1};

	function
		ease_out(progress)
	{
		return (progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress));
	}

	function
		clamp(value, low, high)
	{
		return (Math.max(low, Math.min(high, value)));
	}

	function
		is_typing(element)
	{
		if (!element)
			return (false);

		const	tag = element.tagName;

		return (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true);
	}

	function
		can_scroll(element, delta_x, delta_y)
	{
		const	room_x = element.scrollWidth - element.clientWidth;
		const	room_y = element.scrollHeight - element.clientHeight;

		if (delta_y && room_y > 1)
		{
			const	position = element.scrollTop;

			if ((delta_y < 0 && position > 1) || (delta_y > 0 && position < room_y - 1))
				return (true);
		}

		if (delta_x && room_x > 1)
		{
			const	position = element.scrollLeft;

			if ((delta_x < 0 && position > 1) || (delta_x > 0 && position < room_x - 1))
				return (true);
		}

		return (false);
	}

	function
		scrollable_between(from, until, delta_x, delta_y)
	{
		for (let element = from; element && element !== until; element = element.parentElement || (element.parentNode && element.parentNode.host))
		{
			if (element.nodeType !== 1)
				continue ;

			const	style = window.getComputedStyle(element);
			const	overflow = style.overflowX + " " + style.overflowY;

			if (/auto|scroll|overlay/.test(overflow) && can_scroll(element, delta_x, delta_y))
				return (true);
		}

		return (false);
	}

	let	active_instance = null;

	function
		start(options)
	{
		if (typeof(window) === "undefined" || typeof(document) === "undefined")
			throw (new Error("smooth_scroll: needs a browser"));

		options = options || {};

		if (active_instance)
			active_instance.stop();

		const	abort = new AbortController();
		const	listen = {signal: abort.signal, passive: true};
		const	active = {signal: abort.signal, passive: false};
		const	scrollers = new Map();
		const	page_element = document.scrollingElement || document.documentElement;
		const	default_easing = typeof(options.easing) === "function" ? options.easing : ease_out;
		const	default_mode = options.friction > 0 ? "friction" : "duration";
		const	default_duration = options.duration > 0 ? options.duration : DEFAULT_DURATION;
		const	default_friction = options.friction > 0 ? options.friction : DEFAULT_FRICTION;
		const	use_touch = options.touch !== false;
		const	use_keyboard = options.keyboard !== false;
		const	use_anchors = options.anchors !== false;
		const	watch_dom = options.watch_dom !== false;
		const	respect_reduced_motion = options.reduced_motion !== "ignore";
		const	reduced_motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

		let	running = true;
		let	frame_id = 0;
		let	last_time = 0;
		let	mutation_observer = null;

		function
			is_instant()
		{
			return (respect_reduced_motion && reduced_motion && reduced_motion.matches);
		}

		function
			element_of(target)
		{
			if (target === window || target === document || target === document.documentElement || target === document.body)
				return (page_element);

			if (target instanceof Element)
				return (target);

			return (null);
		}

		function
			position_of(scroller, axis)
		{
			return (axis === "y" ? scroller.element.scrollTop : scroller.element.scrollLeft);
		}

		function
			room_of(scroller, axis)
		{
			const	element = scroller.element;

			if (axis === "y")
				return (Math.max(0, element.scrollHeight - element.clientHeight));

			return (Math.max(0, element.scrollWidth - element.clientWidth));
		}

		function
			sync(scroller)
		{
			scroller.current_y = scroller.target_y = scroller.written_y = position_of(scroller, "y");
			scroller.current_x = scroller.target_x = scroller.written_x = position_of(scroller, "x");
			scroller.animating = false;
		}

		function
			add(target, element_options)
		{
			const	element = element_of(target);

			if (!element)
				return (null);

			let	scroller = scrollers.get(element);

			if (scroller)
			{
				if (element_options && element_options.friction > 0)
				{
					scroller.friction = element_options.friction;
					scroller.mode = "friction";
				}

				if (element_options && element_options.duration > 0)
				{
					scroller.duration = element_options.duration;
					scroller.mode = "duration";
				}

				return (scroller);
			}

			const	attribute = (element.getAttribute(ATTRIBUTE) || "").trim();
			const	attribute_value = parseFloat(attribute);
			const	attribute_is_duration = /s$/i.test(attribute);

			scroller =
			{
				element: element,
				is_page: element === page_element,
				mode: (
					element_options && element_options.friction > 0 ? "friction" :
					element_options && element_options.duration > 0 ? "duration" :
					attribute_value > 0 ? (attribute_is_duration ? "duration" : "friction") :
					default_mode
				),
				duration: (
					element_options && element_options.duration > 0 ? element_options.duration :
					attribute_value > 0 && attribute_is_duration ? attribute_value : default_duration
				),
				easing: element_options && typeof(element_options.easing) === "function" ? element_options.easing : default_easing,
				friction: (
					element_options && element_options.friction > 0 ? element_options.friction :
					attribute_value > 0 && !attribute_is_duration ? attribute_value : default_friction
				),
				start_x: 0,
				start_y: 0,
				tween_time: 0,
				current_x: 0,
				current_y: 0,
				target_x: 0,
				target_y: 0,
				written_x: 0,
				written_y: 0,
				animating: false,
				pointer: 0,
				touch_action: ""
			};
			sync(scroller);
			scrollers.set(element, scroller);

			const	listener_target = scroller.is_page ? window : element;

			scroller.listener_target = listener_target;
			listener_target.addEventListener("wheel", on_wheel, active);
			(scroller.is_page ? document : element).addEventListener("scroll", on_scroll, listen);

			if (use_keyboard)
				(scroller.is_page ? document : element).addEventListener("keydown", on_key, active);

			if (use_touch)
			{
				scroller.touch_action = element.style.touchAction;
				element.style.touchAction = "pinch-zoom";
				element.addEventListener("pointerdown", on_pointer_down, active);
			}

			if (use_anchors)
				element.addEventListener("click", on_click, active);

			return (scroller);
		}

		function
			remove(target)
		{
			const	element = element_of(target);
			const	scroller = element && scrollers.get(element);

			if (!scroller)
				return ;

			scroller.listener_target.removeEventListener("wheel", on_wheel, active);
			(scroller.is_page ? document : element).removeEventListener("scroll", on_scroll, listen);
			(scroller.is_page ? document : element).removeEventListener("keydown", on_key, active);
			element.removeEventListener("pointerdown", on_pointer_down, active);
			element.removeEventListener("click", on_click, active);

			if (use_touch)
				element.style.touchAction = scroller.touch_action;

			scrollers.delete(element);
		}

		function
			scroller_from_event(event)
		{
			const	source = event.currentTarget;

			if (source === window || source === document)
				return (scrollers.get(page_element) || null);

			return (scrollers.get(source) || null);
		}

		function
			wake()
		{
			if (running && !frame_id)
			{
				last_time = 0;
				frame_id = window.requestAnimationFrame(frame);
			}
		}

		function
			push(scroller, delta_x, delta_y)
		{
			if (!scroller.animating)
			{
				scroller.current_y = scroller.target_y = position_of(scroller, "y");
				scroller.current_x = scroller.target_x = position_of(scroller, "x");
			}

			scroller.target_y = clamp(scroller.target_y + delta_y, 0, room_of(scroller, "y"));
			scroller.target_x = clamp(scroller.target_x + delta_x, 0, room_of(scroller, "x"));
			restart(scroller);
			wake();
		}

		function
			go_to(scroller, x, y, immediate)
		{
			scroller.target_y = clamp(y, 0, room_of(scroller, "y"));
			scroller.target_x = clamp(x, 0, room_of(scroller, "x"));

			if (immediate || is_instant())
			{
				scroller.current_y = scroller.target_y;
				scroller.current_x = scroller.target_x;
				write(scroller);
				scroller.animating = false;
				return ;
			}

			restart(scroller);
			wake();
		}

		function
			restart(scroller)
		{
			scroller.start_y = scroller.current_y;
			scroller.start_x = scroller.current_x;
			scroller.tween_time = 0;
			scroller.animating = true;
		}

		function
			write(scroller)
		{
			const	element = scroller.element;

			if (Math.abs(scroller.written_y - scroller.current_y) > 0.01)
			{
				element.scrollTop = scroller.current_y;
				scroller.written_y = element.scrollTop;
			}

			if (Math.abs(scroller.written_x - scroller.current_x) > 0.01)
			{
				element.scrollLeft = scroller.current_x;
				scroller.written_x = element.scrollLeft;
			}
		}

		function
			frame(now)
		{
			frame_id = 0;

			const	delta_time = last_time ? Math.min((now - last_time) / 1000, MAX_FRAME_TIME) : 1 / 60;
			let		busy = false;

			last_time = now;

			for (const	scroller of scrollers.values())
			{
				if (!scroller.animating)
					continue ;

				if (scroller.pointer)
				{
					scroller.current_y = scroller.target_y;
					scroller.current_x = scroller.target_x;
				}
				else if (scroller.mode === "duration")
				{
					/* A tween with an ease-out curve: it slows down and then
					** truly lands, instead of creeping toward the target. */
					scroller.tween_time += delta_time;

					const	progress = Math.min(1, scroller.tween_time / scroller.duration);
					const	eased = scroller.easing(progress);

					scroller.current_y = scroller.start_y + (scroller.target_y - scroller.start_y) * eased;
					scroller.current_x = scroller.start_x + (scroller.target_x - scroller.start_x) * eased;

					if (progress >= 1)
					{
						scroller.current_y = scroller.target_y;
						scroller.current_x = scroller.target_x;
						scroller.animating = false;
					}
				}
				else
				{
					const	rate = -Math.log(1 - Math.min(0.999, scroller.friction)) * 60;
					const	factor = 1 - Math.exp(-rate * delta_time);

					scroller.current_y += (scroller.target_y - scroller.current_y) * factor;
					scroller.current_x += (scroller.target_x - scroller.current_x) * factor;

					if (
						Math.abs(scroller.target_y - scroller.current_y) < STOP_DISTANCE &&
						Math.abs(scroller.target_x - scroller.current_x) < STOP_DISTANCE
					)
					{
						scroller.current_y = scroller.target_y;
						scroller.current_x = scroller.target_x;
						scroller.animating = false;
					}
				}

				write(scroller);
				busy = busy || scroller.animating;
			}

			if (busy)
				frame_id = window.requestAnimationFrame(frame);
			else
				last_time = 0;
		}

		function
			on_wheel(event)
		{
			if (event.ctrlKey || event.smooth_scroll_handled)
				return ;

			const	scroller = scroller_from_event(event);

			if (!scroller)
				return ;

			let	delta_x = event.deltaX;
			let	delta_y = event.deltaY;

			if (event.deltaMode === 1)
			{
				delta_x *= WHEEL_LINE;
				delta_y *= WHEEL_LINE;
			}
			else if (event.deltaMode === 2)
			{
				delta_x *= scroller.element.clientWidth;
				delta_y *= scroller.element.clientHeight;
			}

			if (event.shiftKey && !delta_x)
			{
				delta_x = delta_y;
				delta_y = 0;
			}

			if (scrollable_between(event.target, scroller.element, delta_x, delta_y) || !can_scroll(scroller.element, delta_x, delta_y))
				return ;

			event.smooth_scroll_handled = true;
			event.preventDefault();

			if (is_instant())
			{
				go_to(scroller, position_of(scroller, "x") + delta_x, position_of(scroller, "y") + delta_y, true);
				return ;
			}

			push(scroller, delta_x, delta_y);
		}

		function
			on_scroll(event)
		{
			const	scroller = scrollers.get(event.target === document ? page_element : event.target);

			if (!scroller || scroller.pointer)
				return ;

			if (Math.abs(position_of(scroller, "y") - scroller.written_y) > SYNC_TOLERANCE || Math.abs(position_of(scroller, "x") - scroller.written_x) > SYNC_TOLERANCE)
				sync(scroller);
		}

		function
			on_key(event)
		{
			if (event.defaultPrevented || event.smooth_scroll_handled || event.ctrlKey || event.metaKey || event.altKey)
				return ;

			if (is_typing(document.activeElement))
				return ;

			const	scroller = scroller_from_event(event);

			if (!scroller)
				return ;

			const	height = scroller.element.clientHeight;
			const	step = KEY_STEPS[event.key];
			let		delta_x = 0;
			let		delta_y = 0;
			let		absolute = null;

			if (step && (event.key === "ArrowDown" || event.key === "ArrowUp"))
				delta_y = step * KEY_STEP;
			else if (step)
				delta_x = step * KEY_STEP;
			else if (event.key === "PageDown" || (event.key === " " && !event.shiftKey))
				delta_y = height * 0.9;
			else if (event.key === "PageUp" || (event.key === " " && event.shiftKey))
				delta_y = -height * 0.9;
			else if (event.key === "Home")
				absolute = 0;
			else if (event.key === "End")
				absolute = room_of(scroller, "y");
			else
				return ;

			if (scrollable_between(document.activeElement, scroller.element, delta_x, delta_y || 1))
				return ;

			event.smooth_scroll_handled = true;
			event.preventDefault();

			if (absolute !== null)
				go_to(scroller, scroller.target_x, absolute, false);
			else
				push(scroller, delta_x, delta_y);
		}

		function
			on_pointer_down(event)
		{
			if (event.pointerType !== "touch" || event.smooth_scroll_handled || is_typing(event.target))
				return ;

			const	scroller = scroller_from_event(event);

			if (!scroller || scrollable_between(event.target, scroller.element, 1, 1))
				return ;

			event.smooth_scroll_handled = true;
			scroller.pointer = event.pointerId;
			scroller.pointer_x = event.clientX;
			scroller.pointer_y = event.clientY;
			scroller.pointer_time = event.timeStamp;
			scroller.speed_x = 0;
			scroller.speed_y = 0;
			scroller.current_y = scroller.target_y = position_of(scroller, "y");
			scroller.current_x = scroller.target_x = position_of(scroller, "x");
			scroller.animating = true;
			window.addEventListener("pointermove", on_pointer_move, active);
			window.addEventListener("pointerup", on_pointer_up, listen);
			window.addEventListener("pointercancel", on_pointer_up, listen);
			wake();
		}

		function
			pointer_scroller(event)
		{
			for (const	scroller of scrollers.values())
				if (scroller.pointer === event.pointerId)
					return (scroller);

			return (null);
		}

		function
			on_pointer_move(event)
		{
			const	scroller = pointer_scroller(event);

			if (!scroller)
				return ;

			const	delta_x = scroller.pointer_x - event.clientX;
			const	delta_y = scroller.pointer_y - event.clientY;
			const	delta_time = Math.max(1, event.timeStamp - scroller.pointer_time) / 1000;

			scroller.pointer_x = event.clientX;
			scroller.pointer_y = event.clientY;
			scroller.pointer_time = event.timeStamp;
			scroller.speed_x = delta_x / delta_time;
			scroller.speed_y = delta_y / delta_time;
			scroller.target_y = clamp(scroller.target_y + delta_y, 0, room_of(scroller, "y"));
			scroller.target_x = clamp(scroller.target_x + delta_x, 0, room_of(scroller, "x"));

			if (event.cancelable)
				event.preventDefault();

			wake();
		}

		function
			on_pointer_up(event)
		{
			const	scroller = pointer_scroller(event);

			if (!scroller)
				return ;

			const	inertia = event.timeStamp - scroller.pointer_time < 100 ? 0.2 : 0;

			scroller.pointer = 0;
			window.removeEventListener("pointermove", on_pointer_move, active);
			window.removeEventListener("pointerup", on_pointer_up, listen);
			window.removeEventListener("pointercancel", on_pointer_up, listen);
			scroller.target_y = clamp(scroller.target_y + scroller.speed_y * inertia, 0, room_of(scroller, "y"));
			scroller.target_x = clamp(scroller.target_x + scroller.speed_x * inertia, 0, room_of(scroller, "x"));
			restart(scroller);
			wake();
		}

		function
			on_click(event)
		{
			if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey)
				return ;

			const	link = event.target.closest && event.target.closest("a[href]");

			if (!link)
				return ;

			const	href = link.getAttribute("href");

			if (!href || href.charAt(0) !== "#" || href.length < 2)
				return ;

			const	destination = document.getElementById(decodeURIComponent(href.slice(1)));
			const	scroller = destination && scroller_from_event(event);

			if (!destination || !scroller || !scroller.element.contains(destination))
				return ;

			event.preventDefault();
			scroll_to(destination, {scroller: scroller});

			if (window.history && window.history.pushState)
				window.history.pushState(null, "", href);
		}

		function
			scroll_to(target, scroll_options)
		{
			scroll_options = scroll_options || {};

			const	offset = Number(scroll_options.offset) || 0;
			const	destination = typeof(target) === "string" && target.charAt(0) !== "#" ? document.querySelector(target) : (
				typeof(target) === "string" ? document.getElementById(target.slice(1)) : target
			);
			let		scroller = scroll_options.scroller || null;

			if (typeof(destination) === "number")
			{
				scroller = scroller || scrollers.get(page_element) || scrollers.values().next().value;

				if (scroller)
					go_to(scroller, scroller.target_x, destination + offset, scroll_options.immediate);

				return (scroller);
			}

			if (!(destination instanceof Element))
				return (null);

			if (!scroller)
			{
				for (const	candidate of scrollers.values())
					if (candidate.element.contains(destination) && (!scroller || scroller.element.contains(candidate.element)))
						scroller = candidate;
			}

			if (!scroller)
				return (null);

			const	element_rect = destination.getBoundingClientRect();
			const	scroller_rect = scroller.is_page ? {top: 0, left: 0} : scroller.element.getBoundingClientRect();
			const	y = position_of(scroller, "y") + element_rect.top - scroller_rect.top + offset;
			const	x = position_of(scroller, "x") + element_rect.left - scroller_rect.left;

			go_to(scroller, x, y, scroll_options.immediate);
			return (scroller);
		}

		function
			scan()
		{
			for (const	element of document.querySelectorAll("[" + ATTRIBUTE + "]"))
				add(element);
		}

		function
			on_mutation()
		{
			scan();
		}

		function
			setup()
		{
			if (!running)
				return ;

			if (options.targets === undefined)
				scan();
			else if (Array.isArray(options.targets) || options.targets instanceof NodeList)
			{
				for (const	target of options.targets)
					add(target);
			}
			else if (typeof(options.targets) === "string")
			{
				for (const	element of document.querySelectorAll(options.targets))
					add(element);
			}
			else
				add(options.targets);

			if (watch_dom && window.MutationObserver)
			{
				mutation_observer = new MutationObserver(on_mutation);
				mutation_observer.observe(document.documentElement, {subtree: true, childList: true, attributeFilter: [ATTRIBUTE]});
			}
		}

		if (document.readyState === "loading")
			document.addEventListener("DOMContentLoaded", setup, {signal: abort.signal, once: true});
		else
			setup();

		const	instance =
		{
			stop: function()
			{
				if (!running)
					return ;

				running = false;

				for (const	element of Array.from(scrollers.keys()))
					remove(element);

				abort.abort();

				if (frame_id)
					window.cancelAnimationFrame(frame_id);

				if (mutation_observer)
					mutation_observer.disconnect();

				if (active_instance === instance)
					active_instance = null;
			},

			add: function(target, element_options)
			{
				add(target, element_options);
				return (instance);
			},

			remove: function(target)
			{
				remove(target);
				return (instance);
			},

			scroll_to: function(target, scroll_options)
			{
				scroll_to(target, scroll_options);
				return (instance);
			},

			set_friction: function(value, target)
			{
				const	element = target ? element_of(target) : null;

				for (const	scroller of scrollers.values())
					if (!element || scroller.element === element)
					{
						scroller.friction = value > 0 ? value : DEFAULT_FRICTION;
						scroller.mode = "friction";
					}

				return (instance);
			},

			set_duration: function(value, target)
			{
				const	element = target ? element_of(target) : null;

				for (const	scroller of scrollers.values())
					if (!element || scroller.element === element)
					{
						scroller.duration = value > 0 ? value : DEFAULT_DURATION;
						scroller.mode = "duration";
					}

				return (instance);
			},

			set_easing: function(value, target)
			{
				const	element = target ? element_of(target) : null;

				for (const	scroller of scrollers.values())
					if (!element || scroller.element === element)
						scroller.easing = typeof(value) === "function" ? value : ease_out;

				return (instance);
			},

			refresh: function()
			{
				for (const	scroller of scrollers.values())
					if (!scroller.animating)
						sync(scroller);

				return (instance);
			},

			get elements() {return (Array.from(scrollers.keys()));},

			get running() {return (running);}
		};

		active_instance = instance;
		return (instance);
	}

	const	smooth_scroll = Object.freeze(
		{
			start: start,
			stop: function()
			{
				if (active_instance)
					active_instance.stop();
			}
		}
	);

	if (typeof(module) === "object" && module.exports)
		module.exports = smooth_scroll;

	global_object.smooth_scroll = smooth_scroll;
})(typeof(globalThis) !== "undefined" ? globalThis : this);
