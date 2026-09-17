/******************************************************************************\
# smooth_scroll                                  #       Maximum Tension       #
################################################################################
#                                                #      -__            __-     #
# Teoman Deniz                                   #  :    :!1!-_    _-!1!:    : #
# maximum-tension.com                            #  ::                      :: #
#                                                #  :!:    : :: : :  :  ::::!: #
# +.....................++.....................+ #   :!:: :!:!1:!:!::1:::!!!:  #
# : C - Maximum Tension :: Create - 2026/09/17 : #   ::!::!!1001010!:!11!!::   #
# :---------------------::---------------------: #   :!1!!11000000000011!!:    #
# : License - MIT       :: Update - 2026/09/17 : #    ::::!!!1!!1!!!1!!!::     #
# +.....................++.....................+ #       ::::!::!:::!::::      #
\******************************************************************************/

/*
** ES module entry.
**
**   import smooth_scroll from "./smooth_scroll.mjs";
**   smooth_scroll.start({friction: 0.04});
*/

import "./smooth_scroll.js";

const	smooth_scroll = globalThis.smooth_scroll;

export const	start = smooth_scroll.start;
export const	stop = smooth_scroll.stop;
export default	smooth_scroll;
