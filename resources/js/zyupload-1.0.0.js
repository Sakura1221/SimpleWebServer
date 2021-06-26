
/**
 * zyupload.tailor.js   -- HTML5多文件上传的全部功能性js代码, 包含拖拽上传、裁剪图片等功能
 * 当前包含4个具体部分
 * 1. jquery.Jcrop.js   -- zyupload调用的开源的裁剪图片插件
 * 2. zyPopup.js        -- zyupload调用的弹出框插件
 * 3. zyFile.js         -- zyupload调用的数据处理层
 * 4. zyUpload.js       -- zyupload调用的业务层
 */


/**
 * jquery.Jcrop.js v0.9.8
 * zyupload调用的开源的裁剪图片插件 -- 供zyPopup.js使用
 */

(function($) {

$.Jcrop = function(obj,opt)
{
	// Initialization {{{

	// Sanitize some options {{{
	var obj = obj, opt = opt;

	if (typeof(obj) !== 'object') obj = $(obj)[0];
	if (typeof(opt) !== 'object') opt = { };

	// Some on-the-fly fixes for MSIE...sigh
	if (!('trackDocument' in opt))
	{
		opt.trackDocument = $.browser.msie ? false : true;
		if ($.browser.msie && $.browser.version.split('.')[0] == '8')
			opt.trackDocument = true;
	}

	if (!('keySupport' in opt))
			opt.keySupport = $.browser.msie ? false : true;
		
	// }}}
	// Extend the default options {{{
	var defaults = {

		// Basic Settings
		trackDocument:		false,
		baseClass:			'jcrop',
		addClass:			null,

		// Styling Options
		bgColor:			'black',
		bgOpacity:			.6,
		borderOpacity:		.4,
		handleOpacity:		.5,

		handlePad:			5,
		handleSize:			9,
		handleOffset:		5,
		edgeMargin:			14,

		aspectRatio:		0,
		keySupport:			true,
		cornerHandles:		true,
		sideHandles:		true,
		drawBorders:		true,
		dragEdges:			true,

		boxWidth:			0,
		boxHeight:			0,

		boundary:			8,
		animationDelay:		20,
		swingSpeed:			3,

		allowSelect:		true,
		allowMove:			true,
		allowResize:		true,

		minSelect:			[ 0, 0 ],
		maxSize:			[ 0, 0 ],
		minSize:			[ 0, 0 ],

		// Callbacks / Event Handlers
		onChange: function() { },
		onSelect: function() { }

	};
	var options = defaults;
	setOptions(opt);

	// }}}
	// Initialize some jQuery objects {{{

	var $origimg = $(obj);
	var $img = $origimg.clone().removeAttr('id').css({ position: 'absolute' });

	$img.width($origimg.width());
	$img.height($origimg.height());
	$origimg.after($img).hide();

	presize($img,options.boxWidth,options.boxHeight);

	var boundx = $img.width(),
		boundy = $img.height(),

		$div = $('<div />')
			.width(boundx).height(boundy)
			.addClass(cssClass('holder'))
			.css({
				position: 'relative',
				backgroundColor: options.bgColor
			}).insertAfter($origimg).append($img);
	;
	
	if (options.addClass) $div.addClass(options.addClass);
	//$img.wrap($div);

	var $img2 = $('<img />')/*{{{*/
			.attr('src',$img.attr('src'))
			.css('position','absolute')
			.width(boundx).height(boundy)
	;/*}}}*/
	var $img_holder = $('<div />')/*{{{*/
		.width(pct(100)).height(pct(100))
		.css({
			zIndex: 310,
			position: 'absolute',
			overflow: 'hidden'
		})
		.append($img2)
	;/*}}}*/
	var $hdl_holder = $('<div />')/*{{{*/
		.width(pct(100)).height(pct(100))
		.css('zIndex',320);
	/*}}}*/
	var $sel = $('<div />')/*{{{*/
		.css({
			position: 'absolute',
			zIndex: 300
		})
		.insertBefore($img)
		.append($img_holder,$hdl_holder)
	;/*}}}*/

	var bound = options.boundary;
	var $trk = newTracker().width(boundx+(bound*2)).height(boundy+(bound*2))
		.css({ position: 'absolute', top: px(-bound), left: px(-bound), zIndex: 290 })
		.mousedown(newSelection);	
	
	/* }}} */
	// Set more variables {{{

	var xlimit, ylimit, xmin, ymin;
	var xscale, yscale, enabled = true;
	var docOffset = getPos($img),
		// Internal states
		btndown, lastcurs, dimmed, animating,
		shift_down;

	// }}}
		

		// }}}
	// Internal Modules {{{

	var Coords = function()/*{{{*/
	{
		var x1 = 0, y1 = 0, x2 = 0, y2 = 0, ox, oy;

		function setPressed(pos)/*{{{*/
		{
			var pos = rebound(pos);
			x2 = x1 = pos[0];
			y2 = y1 = pos[1];
		};
		/*}}}*/
		function setCurrent(pos)/*{{{*/
		{
			var pos = rebound(pos);
			ox = pos[0] - x2;
			oy = pos[1] - y2;
			x2 = pos[0];
			y2 = pos[1];
		};
		/*}}}*/
		function getOffset()/*{{{*/
		{
			return [ ox, oy ];
		};
		/*}}}*/
		function moveOffset(offset)/*{{{*/
		{
			var ox = offset[0], oy = offset[1];

			if (0 > x1 + ox) ox -= ox + x1;
			if (0 > y1 + oy) oy -= oy + y1;

			if (boundy < y2 + oy) oy += boundy - (y2 + oy);
			if (boundx < x2 + ox) ox += boundx - (x2 + ox);

			x1 += ox;
			x2 += ox;
			y1 += oy;
			y2 += oy;
		};
		/*}}}*/
		function getCorner(ord)/*{{{*/
		{
			var c = getFixed();
			switch(ord)
			{
				case 'ne': return [ c.x2, c.y ];
				case 'nw': return [ c.x, c.y ];
				case 'se': return [ c.x2, c.y2 ];
				case 'sw': return [ c.x, c.y2 ];
			}
		};
		/*}}}*/
		function getFixed()/*{{{*/
		{
			if (!options.aspectRatio) return getRect();
			// This function could use some optimization I think...
			var aspect = options.aspectRatio,
				min_x = options.minSize[0]/xscale, 
				min_y = options.minSize[1]/yscale,
				max_x = options.maxSize[0]/xscale, 
				max_y = options.maxSize[1]/yscale,
				rw = x2 - x1,
				rh = y2 - y1,
				rwa = Math.abs(rw),
				rha = Math.abs(rh),
				real_ratio = rwa / rha,
				xx, yy
			;
			if (max_x == 0) { max_x = boundx * 10 }
			if (max_y == 0) { max_y = boundy * 10 }
			if (real_ratio < aspect)
			{
				yy = y2;
				w = rha * aspect;
				xx = rw < 0 ? x1 - w : w + x1;

				if (xx < 0)
				{
					xx = 0;
					h = Math.abs((xx - x1) / aspect);
					yy = rh < 0 ? y1 - h: h + y1;
				}
				else if (xx > boundx)
				{
					xx = boundx;
					h = Math.abs((xx - x1) / aspect);
					yy = rh < 0 ? y1 - h : h + y1;
				}
			}
			else
			{
				xx = x2;
				h = rwa / aspect;
				yy = rh < 0 ? y1 - h : y1 + h;
				if (yy < 0)
				{
					yy = 0;
					w = Math.abs((yy - y1) * aspect);
					xx = rw < 0 ? x1 - w : w + x1;
				}
				else if (yy > boundy)
				{
					yy = boundy;
					w = Math.abs(yy - y1) * aspect;
					xx = rw < 0 ? x1 - w : w + x1;
				}
			}

			// Magic %-)
			if(xx > x1) { // right side
			  if(xx - x1 < min_x) {
				xx = x1 + min_x;
			  } else if (xx - x1 > max_x) {
				xx = x1 + max_x;
			  }
			  if(yy > y1) {
				yy = y1 + (xx - x1)/aspect;
			  } else {
				yy = y1 - (xx - x1)/aspect;
			  }
			} else if (xx < x1) { // left side
			  if(x1 - xx < min_x) {
				xx = x1 - min_x
			  } else if (x1 - xx > max_x) {
				xx = x1 - max_x;
			  }
			  if(yy > y1) {
				yy = y1 + (x1 - xx)/aspect;
			  } else {
				yy = y1 - (x1 - xx)/aspect;
			  }
			}

			if(xx < 0) {
				x1 -= xx;
				xx = 0;
			} else  if (xx > boundx) {
				x1 -= xx - boundx;
				xx = boundx;
			}

			if(yy < 0) {
				y1 -= yy;
				yy = 0;
			} else  if (yy > boundy) {
				y1 -= yy - boundy;
				yy = boundy;
			}

			return last = makeObj(flipCoords(x1,y1,xx,yy));
		};
		/*}}}*/
		function rebound(p)/*{{{*/
		{
			if (p[0] < 0) p[0] = 0;
			if (p[1] < 0) p[1] = 0;

			if (p[0] > boundx) p[0] = boundx;
			if (p[1] > boundy) p[1] = boundy;

			return [ p[0], p[1] ];
		};
		/*}}}*/
		function flipCoords(x1,y1,x2,y2)/*{{{*/
		{
			var xa = x1, xb = x2, ya = y1, yb = y2;
			if (x2 < x1)
			{
				xa = x2;
				xb = x1;
			}
			if (y2 < y1)
			{
				ya = y2;
				yb = y1;
			}
			return [ Math.round(xa), Math.round(ya), Math.round(xb), Math.round(yb) ];
		};
		/*}}}*/
		function getRect()/*{{{*/
		{
			var xsize = x2 - x1;
			var ysize = y2 - y1;

			if (xlimit && (Math.abs(xsize) > xlimit))
				x2 = (xsize > 0) ? (x1 + xlimit) : (x1 - xlimit);
			if (ylimit && (Math.abs(ysize) > ylimit))
				y2 = (ysize > 0) ? (y1 + ylimit) : (y1 - ylimit);

			if (ymin && (Math.abs(ysize) < ymin))
				y2 = (ysize > 0) ? (y1 + ymin) : (y1 - ymin);
			if (xmin && (Math.abs(xsize) < xmin))
				x2 = (xsize > 0) ? (x1 + xmin) : (x1 - xmin);

			if (x1 < 0) { x2 -= x1; x1 -= x1; }
			if (y1 < 0) { y2 -= y1; y1 -= y1; }
			if (x2 < 0) { x1 -= x2; x2 -= x2; }
			if (y2 < 0) { y1 -= y2; y2 -= y2; }
			if (x2 > boundx) { var delta = x2 - boundx; x1 -= delta; x2 -= delta; }
			if (y2 > boundy) { var delta = y2 - boundy; y1 -= delta; y2 -= delta; }
			if (x1 > boundx) { var delta = x1 - boundy; y2 -= delta; y1 -= delta; }
			if (y1 > boundy) { var delta = y1 - boundy; y2 -= delta; y1 -= delta; }

			return makeObj(flipCoords(x1,y1,x2,y2));
		};
		/*}}}*/
		function makeObj(a)/*{{{*/
		{
			return { x: a[0], y: a[1], x2: a[2], y2: a[3],
				w: a[2] - a[0], h: a[3] - a[1] };
		};
		/*}}}*/

		return {
			flipCoords: flipCoords,
			setPressed: setPressed,
			setCurrent: setCurrent,
			getOffset: getOffset,
			moveOffset: moveOffset,
			getCorner: getCorner,
			getFixed: getFixed
		};
	}();

	/*}}}*/
	var Selection = function()/*{{{*/
	{
		var start, end, dragmode, awake, hdep = 370;
		var borders = { };
		var handle = { };
		var seehandles = false;
		var hhs = options.handleOffset;

		/* Insert draggable elements {{{*/

		// Insert border divs for outline
		if (options.drawBorders) {
			borders = {
					top: insertBorder('hline')
						.css('top',$.browser.msie?px(-1):px(0)),
					bottom: insertBorder('hline'),
					left: insertBorder('vline'),
					right: insertBorder('vline')
			};
		}

		// Insert handles on edges
		if (options.dragEdges) {
			handle.t = insertDragbar('n');
			handle.b = insertDragbar('s');
			handle.r = insertDragbar('e');
			handle.l = insertDragbar('w');
		}

		// Insert side handles
		options.sideHandles &&
			createHandles(['n','s','e','w']);

		// Insert corner handles
		options.cornerHandles &&
			createHandles(['sw','nw','ne','se']);

		/*}}}*/
		// Private Methods
		function insertBorder(type)/*{{{*/
		{
			var jq = $('<div />')
				.css({position: 'absolute', opacity: options.borderOpacity })
				.addClass(cssClass(type));
			$img_holder.append(jq);
			return jq;
		};
		/*}}}*/
		function dragDiv(ord,zi)/*{{{*/
		{
			var jq = $('<div />')
				.mousedown(createDragger(ord))
				.css({
					cursor: ord+'-resize',
					position: 'absolute',
					zIndex: zi 
				})
			;
			$hdl_holder.append(jq);
			return jq;
		};
		/*}}}*/
		function insertHandle(ord)/*{{{*/
		{
			return dragDiv(ord,hdep++)
				.css({ top: px(-hhs+1), left: px(-hhs+1), opacity: options.handleOpacity })
				.addClass(cssClass('handle'));
		};
		/*}}}*/
		function insertDragbar(ord)/*{{{*/
		{
			var s = options.handleSize,
				o = hhs,
				h = s, w = s,
				t = o, l = o;

			switch(ord)
			{
				case 'n': case 's': w = pct(100); break;
				case 'e': case 'w': h = pct(100); break;
			}

			return dragDiv(ord,hdep++).width(w).height(h)
				.css({ top: px(-t+1), left: px(-l+1)});
		};
		/*}}}*/
		function createHandles(li)/*{{{*/
		{
			for(i in li) handle[li[i]] = insertHandle(li[i]);
		};
		/*}}}*/
		function moveHandles(c)/*{{{*/
		{
			var midvert  = Math.round((c.h / 2) - hhs),
				midhoriz = Math.round((c.w / 2) - hhs),
				north = west = -hhs+1,
				east = c.w - hhs,
				south = c.h - hhs,
				x, y;

			'e' in handle &&
				handle.e.css({ top: px(midvert), left: px(east) }) &&
				handle.w.css({ top: px(midvert) }) &&
				handle.s.css({ top: px(south), left: px(midhoriz) }) &&
				handle.n.css({ left: px(midhoriz) });

			'ne' in handle &&
				handle.ne.css({ left: px(east) }) &&
				handle.se.css({ top: px(south), left: px(east) }) &&
				handle.sw.css({ top: px(south) });

			'b' in handle &&
				handle.b.css({ top: px(south) }) &&
				handle.r.css({ left: px(east) });
		};
		/*}}}*/
		function moveto(x,y)/*{{{*/
		{
			$img2.css({ top: px(-y), left: px(-x) });
			$sel.css({ top: px(y), left: px(x) });
		};
		/*}}}*/
		function resize(w,h)/*{{{*/
		{
			$sel.width(w).height(h);
		};
		/*}}}*/
		function refresh()/*{{{*/
		{
			var c = Coords.getFixed();

			Coords.setPressed([c.x,c.y]);
			Coords.setCurrent([c.x2,c.y2]);

			updateVisible();
		};
		/*}}}*/

		// Internal Methods
		function updateVisible()/*{{{*/
			{ if (awake) return update(); };
		/*}}}*/
		function update()/*{{{*/
		{
			var c = Coords.getFixed();

			resize(c.w,c.h);
			moveto(c.x,c.y);

			options.drawBorders &&
				borders['right'].css({ left: px(c.w-1) }) &&
					borders['bottom'].css({ top: px(c.h-1) });

			seehandles && moveHandles(c);
			awake || show();

			options.onChange(unscale(c));
		};
		/*}}}*/
		function show()/*{{{*/
		{
			$sel.show();
			$img.css('opacity',options.bgOpacity);
			awake = true;
		};
		/*}}}*/
		function release()/*{{{*/
		{
			disableHandles();
			$sel.hide();
			$img.css('opacity',1);
			awake = false;
		};
		/*}}}*/
		function showHandles()//{{{
		{
			if (seehandles)
			{
				moveHandles(Coords.getFixed());
				$hdl_holder.show();
			}
		};
		//}}}
		function enableHandles()/*{{{*/
		{ 
			seehandles = true;
			if (options.allowResize)
			{
				moveHandles(Coords.getFixed());
				$hdl_holder.show();
				return true;
			}
		};
		/*}}}*/
		function disableHandles()/*{{{*/
		{
			seehandles = false;
			$hdl_holder.hide();
		};
		/*}}}*/
		function animMode(v)/*{{{*/
		{
			(animating = v) ? disableHandles(): enableHandles();
		};
		/*}}}*/
		function done()/*{{{*/
		{
			animMode(false);
			refresh();
		};
		/*}}}*/

		var $track = newTracker().mousedown(createDragger('move'))
				.css({ cursor: 'move', position: 'absolute', zIndex: 360 })

		$img_holder.append($track);
		disableHandles();

		return {
			updateVisible: updateVisible,
			update: update,
			release: release,
			refresh: refresh,
			setCursor: function (cursor) { $track.css('cursor',cursor); },
			enableHandles: enableHandles,
			enableOnly: function() { seehandles = true; },
			showHandles: showHandles,
			disableHandles: disableHandles,
			animMode: animMode,
			done: done
		};
	}();
	/*}}}*/
	var Tracker = function()/*{{{*/
	{
		var onMove		= function() { },
			onDone		= function() { },
			trackDoc	= options.trackDocument;

		if (!trackDoc)
		{
			$trk
				.mousemove(trackMove)
				.mouseup(trackUp)
				.mouseout(trackUp)
			;
		}

		function toFront()/*{{{*/
		{
			$trk.css({zIndex:450});
			if (trackDoc)
			{
				$(document)
					.mousemove(trackMove)
					.mouseup(trackUp)
				;
			}
		}
		/*}}}*/
		function toBack()/*{{{*/
		{
			$trk.css({zIndex:290});
			if (trackDoc)
			{
				$(document)
					.unbind('mousemove',trackMove)
					.unbind('mouseup',trackUp)
				;
			}
		}
		/*}}}*/
		function trackMove(e)/*{{{*/
		{
			onMove(mouseAbs(e));
		};
		/*}}}*/
		function trackUp(e)/*{{{*/
		{
			e.preventDefault();
			e.stopPropagation();

			if (btndown)
			{
				btndown = false;

				onDone(mouseAbs(e));
				options.onSelect(unscale(Coords.getFixed()));
				toBack();
				onMove = function() { };
				onDone = function() { };
			}

			return false;
		};
		/*}}}*/

		function activateHandlers(move,done)/* {{{ */
		{
			btndown = true;
			onMove = move;
			onDone = done;
			toFront();
			return false;
		};
		/* }}} */

		function setCursor(t) { $trk.css('cursor',t); };

		$img.before($trk);
		return {
			activateHandlers: activateHandlers,
			setCursor: setCursor
		};
	}();
	/*}}}*/
	var KeyManager = function()/*{{{*/
	{
		var $keymgr = $('<input type="radio" />')
				.css({ position: 'absolute', left: '-30px' })
				.keypress(parseKey)
				.blur(onBlur),

			$keywrap = $('<div />')
				.css({
					position: 'absolute',
					overflow: 'hidden'
				})
				.append($keymgr)
		;

		function watchKeys()/*{{{*/
		{
			if (options.keySupport)
			{
				$keymgr.show();
				$keymgr.focus();
			}
		};
		/*}}}*/
		function onBlur(e)/*{{{*/
		{
			$keymgr.hide();
		};
		/*}}}*/
		function doNudge(e,x,y)/*{{{*/
		{
			if (options.allowMove) {
				Coords.moveOffset([x,y]);
				Selection.updateVisible();
			};
			e.preventDefault();
			e.stopPropagation();
		};
		/*}}}*/
		function parseKey(e)/*{{{*/
		{
			if (e.ctrlKey) return true;
			shift_down = e.shiftKey ? true : false;
			var nudge = shift_down ? 10 : 1;
			switch(e.keyCode)
			{
				case 37: doNudge(e,-nudge,0); break;
				case 39: doNudge(e,nudge,0); break;
				case 38: doNudge(e,0,-nudge); break;
				case 40: doNudge(e,0,nudge); break;

				case 27: Selection.release(); break;

				case 9: return true;
			}

			return nothing(e);
		};
		/*}}}*/
		
		if (options.keySupport) $keywrap.insertBefore($img);
		return {
			watchKeys: watchKeys
		};
	}();
	/*}}}*/

	// }}}
	// Internal Methods {{{

	function px(n) { return '' + parseInt(n) + 'px'; };
	function pct(n) { return '' + parseInt(n) + '%'; };
	function cssClass(cl) { return options.baseClass + '-' + cl; };
	function getPos(obj)/*{{{*/
	{
		// Updated in v0.9.4 to use built-in dimensions plugin
		var pos = $(obj).offset();
		return [ pos.left, pos.top ];
	};
	/*}}}*/
	function mouseAbs(e)/*{{{*/
	{
		return [ (e.pageX - docOffset[0]), (e.pageY - docOffset[1]) ];
	};
	/*}}}*/
	function myCursor(type)/*{{{*/
	{
		if (type != lastcurs)
		{
			Tracker.setCursor(type);
			//Handles.xsetCursor(type);
			lastcurs = type;
		}
	};
	/*}}}*/
	function startDragMode(mode,pos)/*{{{*/
	{
		docOffset = getPos($img);
		Tracker.setCursor(mode=='move'?mode:mode+'-resize');

		if (mode == 'move')
			return Tracker.activateHandlers(createMover(pos), doneSelect);

		var fc = Coords.getFixed();
		var opp = oppLockCorner(mode);
		var opc = Coords.getCorner(oppLockCorner(opp));

		Coords.setPressed(Coords.getCorner(opp));
		Coords.setCurrent(opc);

		Tracker.activateHandlers(dragmodeHandler(mode,fc),doneSelect);
	};
	/*}}}*/
	function dragmodeHandler(mode,f)/*{{{*/
	{
		return function(pos) {
			if (!options.aspectRatio) switch(mode)
			{
				case 'e': pos[1] = f.y2; break;
				case 'w': pos[1] = f.y2; break;
				case 'n': pos[0] = f.x2; break;
				case 's': pos[0] = f.x2; break;
			}
			else switch(mode)
			{
				case 'e': pos[1] = f.y+1; break;
				case 'w': pos[1] = f.y+1; break;
				case 'n': pos[0] = f.x+1; break;
				case 's': pos[0] = f.x+1; break;
			}
			Coords.setCurrent(pos);
			Selection.update();
		};
	};
	/*}}}*/
	function createMover(pos)/*{{{*/
	{
		var lloc = pos;
		KeyManager.watchKeys();

		return function(pos)
		{
			Coords.moveOffset([pos[0] - lloc[0], pos[1] - lloc[1]]);
			lloc = pos;
			
			Selection.update();
		};
	};
	/*}}}*/
	function oppLockCorner(ord)/*{{{*/
	{
		switch(ord)
		{
			case 'n': return 'sw';
			case 's': return 'nw';
			case 'e': return 'nw';
			case 'w': return 'ne';
			case 'ne': return 'sw';
			case 'nw': return 'se';
			case 'se': return 'nw';
			case 'sw': return 'ne';
		};
	};
	/*}}}*/
	function createDragger(ord)/*{{{*/
	{
		return function(e) {
			if (options.disabled) return false;
			if ((ord == 'move') && !options.allowMove) return false;
			btndown = true;
			startDragMode(ord,mouseAbs(e));
			e.stopPropagation();
			e.preventDefault();
			return false;
		};
	};
	/*}}}*/
	function presize($obj,w,h)/*{{{*/
	{
		var nw = $obj.width(), nh = $obj.height();
		if ((nw > w) && w > 0)
		{
			nw = w;
			nh = (w/$obj.width()) * $obj.height();
		}
		if ((nh > h) && h > 0)
		{
			nh = h;
			nw = (h/$obj.height()) * $obj.width();
		}
		xscale = $obj.width() / nw;
		yscale = $obj.height() / nh;
		$obj.width(nw).height(nh);
	};
	/*}}}*/
	function unscale(c)/*{{{*/
	{
		return {
			x: parseInt(c.x * xscale), y: parseInt(c.y * yscale), 
			x2: parseInt(c.x2 * xscale), y2: parseInt(c.y2 * yscale), 
			w: parseInt(c.w * xscale), h: parseInt(c.h * yscale)
		};
	};
	/*}}}*/
	function doneSelect(pos)/*{{{*/
	{
		var c = Coords.getFixed();
		if (c.w > options.minSelect[0] && c.h > options.minSelect[1])
		{
			Selection.enableHandles();
			Selection.done();
		}
		else
		{
			Selection.release();
		}
		Tracker.setCursor( options.allowSelect?'crosshair':'default' );
	};
	/*}}}*/
	function newSelection(e)/*{{{*/
	{
		if (options.disabled) return false;
		if (!options.allowSelect) return false;
		btndown = true;
		docOffset = getPos($img);
		Selection.disableHandles();
		myCursor('crosshair');
		var pos = mouseAbs(e);
		Coords.setPressed(pos);
		Tracker.activateHandlers(selectDrag,doneSelect);
		KeyManager.watchKeys();
		Selection.update();

		e.stopPropagation();
		e.preventDefault();
		return false;
	};
	/*}}}*/
	function selectDrag(pos)/*{{{*/
	{
		Coords.setCurrent(pos);
		Selection.update();
	};
	/*}}}*/
	function newTracker()
	{
		var trk = $('<div></div>').addClass(cssClass('tracker'));
		$.browser.msie && trk.css({ opacity: 0, backgroundColor: 'white' });
		return trk;
	};

	// }}}
	// API methods {{{
		
	function animateTo(a)/*{{{*/
	{
		var x1 = a[0] / xscale,
			y1 = a[1] / yscale,
			x2 = a[2] / xscale,
			y2 = a[3] / yscale;

		if (animating) return;

		var animto = Coords.flipCoords(x1,y1,x2,y2);
		var c = Coords.getFixed();
		var animat = initcr = [ c.x, c.y, c.x2, c.y2 ];
		var interv = options.animationDelay;

		var x = animat[0];
		var y = animat[1];
		var x2 = animat[2];
		var y2 = animat[3];
		var ix1 = animto[0] - initcr[0];
		var iy1 = animto[1] - initcr[1];
		var ix2 = animto[2] - initcr[2];
		var iy2 = animto[3] - initcr[3];
		var pcent = 0;
		var velocity = options.swingSpeed;

		Selection.animMode(true);

		var animator = function()
		{
			return function()
			{
				pcent += (100 - pcent) / velocity;

				animat[0] = x + ((pcent / 100) * ix1);
				animat[1] = y + ((pcent / 100) * iy1);
				animat[2] = x2 + ((pcent / 100) * ix2);
				animat[3] = y2 + ((pcent / 100) * iy2);

				if (pcent < 100) animateStart();
					else Selection.done();

				if (pcent >= 99.8) pcent = 100;

				setSelectRaw(animat);
			};
		}();

		function animateStart()
			{ window.setTimeout(animator,interv); };

		animateStart();
	};
	/*}}}*/
	function setSelect(rect)//{{{
	{
		setSelectRaw([rect[0]/xscale,rect[1]/yscale,rect[2]/xscale,rect[3]/yscale]);
	};
	//}}}
	function setSelectRaw(l) /*{{{*/
	{
		Coords.setPressed([l[0],l[1]]);
		Coords.setCurrent([l[2],l[3]]);
		Selection.update();
	};
	/*}}}*/
	function setOptions(opt)/*{{{*/
	{
		if (typeof(opt) != 'object') opt = { };
		options = $.extend(options,opt);

		if (typeof(options.onChange)!=='function')
			options.onChange = function() { };

		if (typeof(options.onSelect)!=='function')
			options.onSelect = function() { };

	};
	/*}}}*/
	function tellSelect()/*{{{*/
	{
		return unscale(Coords.getFixed());
	};
	/*}}}*/
	function tellScaled()/*{{{*/
	{
		return Coords.getFixed();
	};
	/*}}}*/
	function setOptionsNew(opt)/*{{{*/
	{
		setOptions(opt);
		interfaceUpdate();
	};
	/*}}}*/
	function disableCrop()//{{{
	{
		options.disabled = true;
		Selection.disableHandles();
		Selection.setCursor('default');
		Tracker.setCursor('default');
	};
	//}}}
	function enableCrop()//{{{
	{
		options.disabled = false;
		interfaceUpdate();
	};
	//}}}
	function cancelCrop()//{{{
	{
		Selection.done();
		Tracker.activateHandlers(null,null);
	};
	//}}}
	function destroy()//{{{
	{
		$div.remove();
		$origimg.show();
	};
	//}}}

	function interfaceUpdate(alt)//{{{
	// This method tweaks the interface based on options object.
	// Called when options are changed and at end of initialization.
	{
		options.allowResize ?
			alt?Selection.enableOnly():Selection.enableHandles():
			Selection.disableHandles();

		Tracker.setCursor( options.allowSelect? 'crosshair': 'default' );
		Selection.setCursor( options.allowMove? 'move': 'default' );

		$div.css('backgroundColor',options.bgColor);

		if ('setSelect' in options) {
			setSelect(opt.setSelect);
			Selection.done();
			delete(options.setSelect);
		}

		if ('trueSize' in options) {
			xscale = options.trueSize[0] / boundx;
			yscale = options.trueSize[1] / boundy;
		}

		xlimit = options.maxSize[0] || 0;
		ylimit = options.maxSize[1] || 0;
		xmin = options.minSize[0] || 0;
		ymin = options.minSize[1] || 0;

		if ('outerImage' in options)
		{
			$img.attr('src',options.outerImage);
			delete(options.outerImage);
		}

		Selection.refresh();
	};
	//}}}

	// }}}

	$hdl_holder.hide();
	interfaceUpdate(true);
	
	var api = {
		animateTo: animateTo,
		setSelect: setSelect,
		setOptions: setOptionsNew,
		tellSelect: tellSelect,
		tellScaled: tellScaled,

		disable: disableCrop,
		enable: enableCrop,
		cancel: cancelCrop,

		focus: KeyManager.watchKeys,

		getBounds: function() { return [ boundx * xscale, boundy * yscale ]; },
		getWidgetSize: function() { return [ boundx, boundy ]; },

		release: Selection.release,
		destroy: destroy

	};

	$origimg.data('Jcrop',api);
	return api;
};

$.fn.Jcrop = function(options)/*{{{*/
{
	function attachWhenDone(from)/*{{{*/
	{
		var loadsrc = options.useImg || from.src;
		var img = new Image();
		img.onload = function() { $.Jcrop(from,options); };
		img.src = loadsrc;
	};
	/*}}}*/
	if (typeof(options) !== 'object') options = { };

	// Iterate over each object, attach Jcrop
	this.each(function()
	{
		// If we've already attached to this object
		if ($(this).data('Jcrop'))
		{
			// The API can be requested this way (undocumented)
			if (options == 'api') return $(this).data('Jcrop');
			// Otherwise, we just reset the options...
			else $(this).data('Jcrop').setOptions(options);
		}
		// If we haven't been attached, preload and attach
		else attachWhenDone(this);
	});

	// Return "this" so we're chainable a la jQuery plugin-style!
	return this;
};
/*}}}*/

})(jQuery);

/*
 * zyPopup.js 基于HTML5 文件上传的弹出层脚本 http://www.52doit.com
 * by zhangyan 2014-07-12   QQ : 623585268
*/

(function($,undefined){
	$.fn.zyPopup = function(options,param){
		var otherArgs = Array.prototype.slice.call(arguments, 1);
		if (typeof options == "string") {
			var fn = this[0][options];
			if($.isFunction(fn)){
				return fn.apply(this, otherArgs);
			}else{
				throw ("zyPopup - No such method: " + options);
			}
		}

		return this.each(function(){
			var para = {};    // 保留参数
			var self = this;  // 保存组件对象
			var zoom = "",
		    zoomContent = "",
		    zoomedIn = false,
		    openedImage = null,
		    windowWidth = "",
		    windowHeight = "";
			var tailorVal = {};  // 保留裁剪之后的值
			
			var defaults = {
					src          :     "",                // 图片的src地址
					index        :     0,                 // 图片在预览区域的索引
					name         :     "",                // 图片的名字
					onTailor     :     function(val){}    // 返回图片裁剪的坐标和宽高的值
			};
			
			para = $.extend(defaults,options);
			
			this.init = function(){
				this.createHtml();      // 创建组件html
				this.openPopup();       // 打开弹出层
				this.bindPopupEvent();  // 绑定弹出层事件
			};
			
			/**
			 * 功能：创建弹出层所使用的html
			 * 参数: 无
			 * 返回: 无
			 */
			this.createHtml = function(){
				// 有可能多次创建此插件，所以要先删除
				$("#zoom").remove();
				$("body").append('<div id="zoom"><a class="finish"></a><a class="close"></a><div class="content loading"></div></div>');

				zoom = $("#zoom").hide(),
				zoomContent = $("#zoom .content"),
				zoomedIn = false,
				openedImage = null,
				windowWidth = $(window).width(),
				windowHeight = $(window).height();
			};
			
			/**
			 * 功能：打开弹出层
			 * 参数: 无
			 * 返回: 无
			 */
			this.openPopup = function(){
				var self = this;
				var image = $(new Image()).attr("id","tailorImg").hide();
				$("#zoom .previous, #zoom .next").show();
				if (!zoomedIn) {
					zoomedIn = true;
					zoom.show();
					$("body").addClass("zoomed");
				}
				zoomContent.html(image).delay(500).addClass("loading");
				image.load(render).attr("src", para.src);
				
				// 渲染
				function render() {
					var image = $(this),
					    borderWidth = parseInt(zoomContent.css("borderLeftWidth")),
					    maxImageWidth = windowWidth - (borderWidth * 2),
					    maxImageHeight = windowHeight - (borderWidth * 2),
					    imageWidth = image.width(),
					    imageHeight = image.height();
					if (imageWidth == zoomContent.width() && imageWidth <= maxImageWidth && imageHeight == zoomContent.height() && imageHeight <= maxImageHeight) {
							show(image);
							return;
					}
					zoomContent.animate({
						width: image.width(),
						height: image.height(),
						marginTop: -(image.height() / 2) - borderWidth,
						marginLeft: -(image.width() / 2) - borderWidth
					}, 200, function() {
						show(image);
					});

					// 显示
					function show(image) {
						image.show();
						zoomContent.removeClass("loading");
						self.createTailorPlug();
					}
				}
			};
			
			/**
			 * 功能: 加载裁剪插件
			 * 参数: 无
			 * 返回: 无
			 */
			this.createTailorPlug = function(){
				// 设置默认选择区域的范围
				var width = $("#tailorImg").width();
				var height = $("#tailorImg").height();
				var x1 = (width/2)-(width/5);
				var y1 = (height/2)-(height/5);
				var x2 = (width/2)+(width/5);
				var y2 = (height/2)+(height/5);
				// 创建插件
				var api = $.Jcrop("#tailorImg",{
			        setSelect : [x1,y1,x2,y2], //setSelect是Jcrop插件内部已定义的运动方法
			        onChange : setCoords,
					onSelect : setCoords
			    });
				
				// 设置选择区域的值
				function setCoords(obj){
					tailorVal = {"leftX" : obj.x, "leftY" : obj.y, "rightX" : obj.x2, "rightY" : obj.y2, "width" : obj.w, "height" : obj.h};
				}
			};
			
			/**
			 * 功能: 绑定事件
			 * 参数: 无
			 * 返回: 无
			 */
			this.bindPopupEvent = function(){
				var self = this;
				// 弹出层本身的点击事件
				zoom.bind("click", function(event) {
					event.preventDefault();
					if ($(event.target).attr("id") == "zoom"){
						// 关闭弹出层
						self.closePopup(event);
					}
				});
				
				// 弹出层完成按钮的点击事件
				$("#zoom .finish").bind("click", function(event){
					var quondamImgInfo = new Object();
					quondamImgInfo["width"]  = $(".jcrop-holder>div>div>img").width();
					quondamImgInfo["height"] = $(".jcrop-holder>div>div>img").height();
					// 回调方法，将裁减的数据返回
					para.onTailor(tailorVal, quondamImgInfo);  
					// 关闭弹出层
					self.closePopup(event);
				});
				
				// 弹出层关闭按钮的点击事件
				$("#zoom .close").bind("click", function(event){
					// 关闭弹出层
					self.closePopup(event);
				});
			};
			
			/**
			 * 功能: 打开弹出层
			 * 参数: event 事件源
			 * 返回: 无
			 */
			this.closePopup = function(event){
				if (event){
					event.preventDefault();
				}
				zoomedIn = false;
				openedImage = null;
				zoom.hide();
				$("body").removeClass("zoomed");
				zoomContent.empty();
			};
			
			// 初始化裁剪插件
			this.init();
		});
	};
})(jQuery);



/*
 * zyFile.js 基于HTML5 文件上传的核心脚本 http://www.52doit.com
 * by zhangyan 2014-06-21   QQ : 623585268
*/

var ZYFILE = {
	fileInput : null,             // 选择文件按钮dom对象
	uploadInput : null,           // 上传文件按钮dom对象
	dragDrop: null,				  // 拖拽敏感区域
	url : "",  					  // 上传action路径
	uploadFile : [],  			  // 需要上传的文件数组
	lastUploadFile : [],          // 上一次选择的文件数组，方便继续上传使用
	perUploadFile : [],           // 存放永久的文件数组，方便删除使用
	fileNum : 0,                  // 代表文件总个数，因为涉及到继续添加，所以下一次添加需要在它的基础上添加索引
	/* 提供给外部的接口 */
	filterFile : function(files){ // 提供给外部的过滤文件格式等的接口，外部需要把过滤后的文件返回
		return files;
	},
	onSelect : function(selectFile, files){      // 提供给外部获取选中的文件，供外部实现预览等功能  selectFile:当前选中的文件  allFiles:还没上传的全部文件
		
	},
	onDelete : function(file, files){            // 提供给外部获取删除的单个文件，供外部实现删除效果  file:当前删除的文件  files:删除之后的文件
		
	},
	onProgress : function(file, loaded, total){  // 提供给外部获取单个文件的上传进度，供外部实现上传进度效果
		
	},
	onSuccess : function(file, responseInfo){    // 提供给外部获取单个文件上传成功，供外部实现成功效果
		
	},
	onFailure : function(file, responseInfo){    // 提供给外部获取单个文件上传失败，供外部实现失败效果
	
	},
	onComplete : function(responseInfo){         // 提供给外部获取全部文件上传完成，供外部实现完成效果
		
	},
	
	/* 内部实现功能方法 */
	// 获得选中的文件
	//文件拖放
	funDragHover: function(e) {
		e.stopPropagation();
		e.preventDefault();
		this[e.type === "dragover"? "onDragOver": "onDragLeave"].call(e.target);
		return this;
	},
	// 获取文件
	funGetFiles : function(e){  
		var self = this;
		// 取消鼠标经过样式
		this.funDragHover(e);
		// 从事件中获取选中的所有文件
		var files = e.target.files || e.dataTransfer.files;
		self.lastUploadFile = this.uploadFile;
		this.uploadFile = this.uploadFile.concat(this.filterFile(files));
		var tmpFiles = [];
		
		// 因为jquery的inArray方法无法对object数组进行判断是否存在于，所以只能提取名称进行判断
		var lArr = [];  // 之前文件的名称数组
		var uArr = [];  // 现在文件的名称数组
		$.each(self.lastUploadFile, function(k, v){
			lArr.push(v.name);
		});
		$.each(self.uploadFile, function(k, v){
			uArr.push(v.name);
		});
		
		$.each(uArr, function(k, v){
			// 获得当前选择的每一个文件   判断当前这一个文件是否存在于之前的文件当中
			if($.inArray(v, lArr) < 0){  // 不存在
				tmpFiles.push(self.uploadFile[k]);
			}
		});
		
		// 如果tmpFiles进行过过滤上一次选择的文件的操作，需要把过滤后的文件赋值
		//if(tmpFiles.length!=0){
			this.uploadFile = tmpFiles;
		//}
		
		// 调用对文件处理的方法
		this.funDealtFiles();
		
		return true;
	},
	// 处理过滤后的文件，给每个文件设置下标
	funDealtFiles : function(){
		var self = this;
		// 目前是遍历所有的文件，给每个文件增加唯一索引值
		$.each(this.uploadFile, function(k, v){
			// 因为涉及到继续添加，所以下一次添加需要在总个数的基础上添加
			v.index = self.fileNum;
			// 添加一个之后自增
			self.fileNum++;
		});
		// 先把当前选中的文件保存备份
		var selectFile = this.uploadFile;  
		// 要把全部的文件都保存下来，因为删除所使用的下标是全局的变量
		this.perUploadFile = this.perUploadFile.concat(this.uploadFile);
		// 合并下上传的文件
		this.uploadFile = this.lastUploadFile.concat(this.uploadFile);
		
		// 执行选择回调
		this.onSelect(selectFile, this.uploadFile);
		console.info("继续选择");
		console.info(this.uploadFile);
		return this;
	},
	// 处理需要删除的文件  isCb代表是否回调onDelete方法  
	// 因为上传完成并不希望在页面上删除div，但是单独点击删除的时候需要删除div   所以用isCb做判断
	funDeleteFile : function(delFileIndex, isCb){
		var self = this;  // 在each中this指向没个v  所以先将this保留
		
		var tmpFile = [];  // 用来替换的文件数组
		// 合并下上传的文件
		var delFile = this.perUploadFile[delFileIndex];
		//console.info(delFile);
		// 目前是遍历所有的文件，对比每个文件  删除
		$.each(this.uploadFile, function(k, v){
			if(delFile != v){
				// 如果不是删除的那个文件 就放到临时数组中
				tmpFile.push(v);
			}
		});
		this.uploadFile = tmpFile;
		if(isCb){  // 执行回调
			// 回调删除方法，供外部进行删除效果的实现
			self.onDelete(delFile, this.uploadFile);
		}
		
		console.info("还剩这些文件没有上传:");
		console.info(this.uploadFile);
		return true;
	},
	// 上传多个文件
	funUploadFiles : function(){
		var self = this;  // 在each中this指向没个v  所以先将this保留
		// 遍历所有文件  ，在调用单个文件上传的方法
		$.each(this.uploadFile, function(k, v){
			self.funUploadFile(v);
		});
	},
	// 上传单个个文件
	funUploadFile : function(file){
		var self = this;  // 在each中this指向没个v  所以先将this保留
		var formdata = new FormData();
		formdata.append("file", file);	 
		// 添加裁剪的坐标和宽高发送给后台
		if($("#uploadTailor_"+file.index).length>0){
			// 除了这样获取不到zyUpload的值啊啊啊啊啊啊啊啊啊啊啊
			formdata.append("tailor", $("#uploadTailor_"+file.index).attr("tailor"));	
		}
		var xhr = new XMLHttpRequest();
		// 绑定上传事件
		// 进度
	    xhr.upload.addEventListener("progress",	 function(e){
	    	// 回调到外部
	    	self.onProgress(file, e.loaded, e.total);
	    }, false); 
	    // 完成
	    xhr.addEventListener("load", function(e){
    		// 从文件中删除上传成功的文件  false是不执行onDelete回调方法
	    	self.funDeleteFile(file.index, false);
	    	// 回调到外部
	    	self.onSuccess(file, xhr.responseText);
	    	if(self.uploadFile.length==0){
	    		// 回调全部完成方法
	    		self.onComplete("全部完成");
	    	}
	    }, false);  
	    // 错误
	    xhr.addEventListener("error", function(e){
	    	// 回调到外部
	    	self.onFailure(file, xhr.responseText);
	    }, false);  
		
		xhr.open("POST",self.url, true);
		xhr.send(formdata);
	},
	// 返回需要上传的文件
	funReturnNeedFiles : function(){
		return this.uploadFile;
	},
	
	// 初始化
	init : function(){  // 初始化方法，在此给选择、上传按钮绑定事件
		var self = this;  // 克隆一个自身
		
		if (this.dragDrop) {
			this.dragDrop.addEventListener("dragover", function(e) { self.funDragHover(e); }, false);
			this.dragDrop.addEventListener("dragleave", function(e) { self.funDragHover(e); }, false);
			this.dragDrop.addEventListener("drop", function(e) { self.funGetFiles(e); }, false);
		}
		
		// 如果选择按钮存在
		if(self.fileInput){
			// 绑定change事件
			this.fileInput.addEventListener("change", function(e) {
				self.funGetFiles(e); 
			}, false);	
		}
		
		// 如果上传按钮存在
		if(self.uploadInput){
			// 绑定click事件
			this.uploadInput.addEventListener("click", function(e) {
				self.funUploadFiles(e); 
			}, false);	
		}
	}
};


/*
 * zyUpload.js 基于HTML5 文件上传的血肉脚本 http://www.52doit.com
 * by zhangyan 2014-06-26   QQ : 623585268
*/

(function($,undefined){
	$.fn.zyUpload = function(options,param){
		var otherArgs = Array.prototype.slice.call(arguments, 1);
		if (typeof options == 'string') {
			var fn = this[0][options];
			if($.isFunction(fn)){
				return fn.apply(this, otherArgs);
			}else{
				throw ("zyUpload - No such method: " + options);
			}
		}

		return this.each(function(){
			var para = {};    // 保留参数
			var self = this;  // 保存组件对象
			
			var defaults = {
					width            : "700px",  					      // 宽度
					height           : "400px",  					      // 宽度
					itemWidth        : "140px",                           // 文件项的宽度
					itemHeight       : "120px",                           // 文件项的高度
					url              : "/upload/UploadAction",  	      // 上传文件的路径
					fileType         : [],                                // 上传文件的类型
					fileSize         : 51200000,                          // 上传文件的大小
					multiple         : true,  						      // 是否可以多个文件上传
					dragDrop         : true,  						      // 是否可以拖动上传文件
//					edit             : true,  						      // 是否可以编辑文件（裁剪）
					tailor           : false,  						      // 是否可以截取图片
					del              : true,  						      // 是否可以删除文件
					finishDel        : false,  						      // 是否在上传文件完成后删除预览
					/* 提供给外部的接口方法 */
					onSelect         : function(selectFiles, allFiles){}, // 选择文件的回调方法  selectFile:当前选中的文件  allFiles:还没上传的全部文件
					onDelete		 : function(file, files){},           // 删除一个文件的回调方法 file:当前删除的文件  files:删除之后的文件
					onSuccess		 : function(file, response){},        // 文件上传成功的回调方法
					onFailure		 : function(file, response){},        // 文件上传失败的回调方法
					onComplete		 : function(response){}               // 上传完成的回调方法
			};
			
			para = $.extend(defaults,options);
			
			this.init = function(){
				this.createHtml();  // 创建组件html
				this.createCorePlug();  // 调用核心js
			};
			
			/**
			 * 功能：创建上传所使用的html
			 * 参数: 无
			 * 返回: 无
			 */
			this.createHtml = function(){
				var multiple = "";  // 设置多选的参数
				para.multiple ? multiple = "multiple" : multiple = "";
				var html= '';
				
				if(para.dragDrop){
					// 创建带有拖动的html
					html += '<form id="uploadForm" action="'+para.url+'" method="post" enctype="multipart/form-data">';
					html += '	<div class="upload_box">';
					html += '		<div class="upload_main">';
					html += '			<div class="upload_choose">';
	            	html += '				<div class="convent_choice">';
	            	html += '					<div class="andArea">';
	            	html += '						<div class="filePicker">点击选择文件</div>';
	            	html += '						<input id="fileImage" type="file" size="30" name="fileselect[]" '+multiple+'>';
	            	html += '					</div>';
	            	html += '				</div>';
					html += '				<span id="fileDragArea" class="upload_drag_area">或者将文件拖到此处</span>';
					html += '			</div>';
		            html += '			<div class="status_bar">';
		            html += '				<div id="status_info" class="info">选中0张文件，共0B。</div>';
		            html += '				<div class="btns">';
		            html += '					<div class="webuploader_pick">继续选择</div>';
		            html += '					<div class="upload_btn">开始上传</div>';
		            html += '				</div>';
		            html += '			</div>';
					html += '			<div id="preview" class="upload_preview"></div>';
					html += '		</div>';
					html += '		<div class="upload_submit">';
					html += '			<button type="button" id="fileSubmit" class="upload_submit_btn">确认上传文件</button>';
					html += '		</div>';
					html += '		<div id="uploadInf" class="upload_inf"></div>';
					html += '	</div>';
					html += '</form>';
				}else{
					var imgWidth = parseInt(para.itemWidth.replace("px", ""))-15;
					
					// 创建不带有拖动的html
					html += '<form id="uploadForm" action="'+para.url+'" method="post" enctype="multipart/form-data">';
					html += '	<div class="upload_box">';
					html += '		<div class="upload_main single_main">';
		            html += '			<div class="status_bar">';
		            html += '				<div id="status_info" class="info">选中0张文件，共0B。</div>';
		            html += '				<div class="btns">';
		            html += '					<input id="fileImage" type="file" size="30" name="fileselect[]" '+multiple+'>';
		            html += '					<div class="webuploader_pick">选择文件</div>';
		            html += '					<div class="upload_btn">开始上传</div>';
		            html += '				</div>';
		            html += '			</div>';
		            html += '			<div id="preview" class="upload_preview">';
				    html += '				<div class="add_upload">';
				    html += '					<a style="height:'+para.itemHeight+';width:'+para.itemWidth+';" title="点击添加文件" id="rapidAddImg" class="add_imgBox" href="javascript:void(0)">';
				    html += '						<div class="uploadImg" style="width:'+imgWidth+'px">';
				    html += '							<img class="upload_image" src="zyupload/skins/images/add_img.png" style="width:expression(this.width > '+imgWidth+' ? '+imgWidth+'px : this.width)" />';
				    html += '						</div>'; 
				    html += '					</a>';
				    html += '				</div>';
					html += '			</div>';
					html += '		</div>';
					html += '		<div class="upload_submit">';
					html += '			<button type="button" id="fileSubmit" class="upload_submit_btn">确认上传文件</button>';
					html += '		</div>';
					html += '		<div id="uploadInf" class="upload_inf"></div>';
					html += '	</div>';
					html += '</form>';
				}
				
	            $(self).append(html).css({"width":para.width,"height":para.height});
	            
	            // 初始化html之后绑定按钮的点击事件
	            this.addEvent();
			};
			
			/**
			 * 功能：显示统计信息和绑定继续上传和上传按钮的点击事件
			 * 参数: 无
			 * 返回: 无
			 */
			this.funSetStatusInfo = function(files){
				var size = 0;
				var num = files.length;
				$.each(files, function(k,v){
					// 计算得到文件总大小
					size += v.size;
				});
				
				// 转化为kb和MB格式。文件的名字、大小、类型都是可以现实出来。
				if (size > 1024 * 1024) {                    
					size = (Math.round(size * 100 / (1024 * 1024)) / 100).toString() + 'MB';                
				} else {                    
					size = (Math.round(size * 100 / 1024) / 100).toString() + 'KB';                
				}  
				
				// 设置内容
				$("#status_info").html("选中"+num+"张文件，共"+size+"。");
			};
			
			/**
			 * 功能：过滤上传的文件格式等
			 * 参数: files 本次选择的文件
			 * 返回: 通过的文件
			 */
			this.funFilterEligibleFile = function(files){
				var arrFiles = [];  // 替换的文件数组
				for (var i = 0, file; file = files[i]; i++) {
					// 获取上传文件的后缀名
					var newStr = file.name.split("").reverse().join("");
					if(newStr.split(".")[0] != null){
						var type = newStr.split(".")[0].split("").reverse().join("");
						if(jQuery.inArray(type, para.fileType) > -1){
							// 类型符合，可以上传
							if (file.size >= para.fileSize) {
								alert('您这个"'+ file.name +'"文件大小过大');	
							} else {
								// 在这里需要判断当前所有文件中
								arrFiles.push(file);	
							}
						}else{
							alert('您这个"'+ file.name +'"上传类型不符合');	
						}
					}else{
						alert('您这个"'+ file.name +'"没有类型, 无法识别');	
					}
				}
				return arrFiles;
			};
			
			/**
			 * 功能： 处理参数和格式上的预览html
			 * 参数: files 本次选择的文件
			 * 返回: 预览的html
			 */
			this.funDisposePreviewHtml = function(file, e){
				var html = "";
				var imgWidth = parseInt(para.itemWidth.replace("px", ""))-15;
				var imgHeight = parseInt(para.itemHeight.replace("px", ""))-10;
				
				// 处理配置参数编辑和删除按钮
				var editHtml = "";
				var delHtml = "";
				
				if(para.tailor){  // 显示裁剪按钮
					editHtml = '<span class="file_edit" data-index="'+file.index+'" title="编辑"></span>';
				}
				if(para.del){  // 显示删除按钮
					delHtml = '<span class="file_del" data-index="'+file.index+'" title="删除"></span>';
				}
				
				var newStr = file.name.split("").reverse().join("");
				var type = newStr.split(".")[0].split("").reverse().join("");
				// 处理不同类型文件代表的图标
				var fileImgSrc = "../images/fileType/";
				if(type == "rar"){
					fileImgSrc = fileImgSrc + "rar.png";
				}else if(type == "zip"){
					fileImgSrc = fileImgSrc + "zip.png";
				}else if(type == "txt"){
					fileImgSrc = fileImgSrc + "txt.png";
				}else if(type == "ppt"){
					fileImgSrc = fileImgSrc + "ppt.png";
				}else if(type == "xls"){
					fileImgSrc = fileImgSrc + "xls.png";
				}else if(type == "pdf"){
					fileImgSrc = fileImgSrc + "pdf.png";
				}else if(type == "psd"){
					fileImgSrc = fileImgSrc + "psd.png";
				}else if(type == "ttf"){
					fileImgSrc = fileImgSrc + "ttf.png";
				}else if(type == "swf"){
					fileImgSrc = fileImgSrc + "swf.png";
				}else{
					fileImgSrc = fileImgSrc + "file.png";
				}
				
				
				// 图片上传的是图片还是其他类型文件
				if (file.type.indexOf("image") == 0) {
					html += '<div id="uploadList_'+ file.index +'" class="upload_append_list">';
					html += '	<div class="file_bar">';
					html += '		<div style="padding:5px;">';
					html += '			<p class="file_name" title="'+file.name+'">' + file.name + '</p>';
					html += 			editHtml;  // 编辑按钮的html
					html += 			delHtml;   // 删除按钮的html
					html += '		</div>';
					html += '	</div>';
					html += '	<a style="height:'+para.itemHeight+';width:'+para.itemWidth+';" href="#" class="imgBox">';
					html += '		<div class="uploadImg" style="width:'+imgWidth+'px;max-width:'+imgWidth+'px;max-height:'+imgHeight+'px;">';				
					html += '			<img id="uploadImage_'+file.index+'" class="upload_image" src="' + e.target.result + '" style="width:expression(this.width > '+imgWidth+' ? '+imgWidth+'px : this.width);" />';                                                                 
					html += '		</div>';
					html += '	</a>';
					html += '	<p id="uploadProgress_'+file.index+'" class="file_progress"></p>';
					html += '	<p id="uploadFailure_'+file.index+'" class="file_failure">上传失败，请重试</p>';
					html += '	<p id="uploadTailor_'+file.index+'" class="file_tailor" tailor="false">裁剪完成</p>';
					html += '	<p id="uploadSuccess_'+file.index+'" class="file_success"></p>';
					html += '</div>';
                	
				}else{
					html += '<div id="uploadList_'+ file.index +'" class="upload_append_list">';
					html += '	<div class="file_bar">';
					html += '		<div style="padding:5px;">';
					html += '			<p class="file_name">' + file.name + '</p>';
					html += 			delHtml;   // 删除按钮的html
					html += '		</div>';
					html += '	</div>';
					html += '	<a style="height:'+para.itemHeight+';width:'+para.itemWidth+';" href="#" class="imgBox">';
					html += '		<div class="uploadImg" style="width:'+imgWidth+'px">';				
					html += '			<img id="uploadImage_'+file.index+'" class="upload_file" src="' + fileImgSrc + '" style="width:expression(this.width > '+imgWidth+' ? '+imgWidth+'px : this.width)" />';                                                                 
					html += '		</div>';
					html += '	</a>';
					html += '	<p id="uploadProgress_'+file.index+'" class="file_progress"></p>';
					html += '	<p id="uploadFailure_'+file.index+'" class="file_failure">上传失败，请重试</p>';
					html += '	<p id="uploadSuccess_'+file.index+'" class="file_success"></p>';
					html += '</div>';
				}
				
				return html;
			};
			
			/**
			 * 功能: 创建弹出层插件，会在其中进行裁剪操作
			 * 参数: imgSrc 当前裁剪图片的路径
			 * 返回: 无
			 */
			this.createPopupPlug = function(imgSrc, index, name){
				// 初始化裁剪插件
				$("body").zyPopup({
					src        :   imgSrc,            // 图片的src路径
					index      :   index,             // 图片在预览区域的索引
					name       :   name,              // 图片的名字
					onTailor   :   function(val, quondamImgInfo){     // 回调返回裁剪的坐标和宽高的值
						// 做裁剪成功的图片预览处理
						var nWidth = parseInt(para.itemWidth.replace("px", ""));
						var nHeight = parseInt(para.itemHeight.replace("px", ""));
						var qWidth = val.width;
						var qHeight = val.height;
						
						// 计算出选中区域的的比例
						var ratio = nWidth / qWidth;
						// 计算出原图片在预览区域的宽度和高度
						var width = ratio * quondamImgInfo.width;
						var height = ratio * quondamImgInfo.height;
						// 计算出margin-left和margin-top的值
						var left = val.leftX * ratio;
						var top  = val.rightY * ratio - qHeight * ratio;
						
						$("#uploadImage_" + index).css({
							"width"    : width,
							"height"   : height,
							"margin-left" : -left,
							"margin-top" : -top
						});
						
						$("#uploadTailor_" + index).show();    
						console.info(val);
						var tailor = "{'leftX':"+val.leftX+",'leftY':"+val.leftY+",'rightX':"+val.rightX+",'rightY':"+val.rightY+",'width':"+val.width+",'height':"+val.height+"}";
//						$.getScript("jquery.json-2.4.js", function(){
//							$("#uploadTailor_" + index).attr("tailor",$.toJSON(val));
//						});
						$("#uploadTailor_" + index).attr("tailor",tailor);
					}
				});
			};
			
			/**
			 * 功能：调用核心插件
			 * 参数: 无
			 * 返回: 无
			 */
			this.createCorePlug = function(){
				var params = {
					fileInput: $("#fileImage").get(0),
					uploadInput: $("#fileSubmit").get(0),
					dragDrop: $("#fileDragArea").get(0),
					url: $("#uploadForm").attr("action"),
					
					filterFile: function(files) {
						// 过滤合格的文件
						return self.funFilterEligibleFile(files);
					},
					onSelect: function(selectFiles, allFiles) {
						para.onSelect(selectFiles, allFiles);  // 回调方法
						self.funSetStatusInfo(ZYFILE.funReturnNeedFiles());  // 显示统计信息
						var html = '', i = 0;
						// 组织预览html
						var funDealtPreviewHtml = function() {
							file = selectFiles[i];
							if (file) {
								var reader = new FileReader();
								reader.onload = function(e) {
									// 处理下配置参数和格式的html
									html += self.funDisposePreviewHtml(file, e);
									
									i++;
									// 再接着调用此方法递归组成可以预览的html
									funDealtPreviewHtml();
								}
								reader.readAsDataURL(file);
							} else {
								// 走到这里说明文件html已经组织完毕，要把html添加到预览区
								funAppendPreviewHtml(html);
							}
						};
						
						// 添加预览html
						var funAppendPreviewHtml = function(html){
							// 添加到添加按钮前
							if(para.dragDrop){
								$("#preview").append(html);
							}else{
								$(".add_upload").before(html);
							}
							// 绑定删除按钮
							funBindDelEvent();
							funBindHoverEvent();
						};
						
						// 绑定删除按钮事件
						var funBindDelEvent = function(){
							if($(".file_del").length>0){
								// 删除方法
								$(".file_del").click(function() {
									ZYFILE.funDeleteFile(parseInt($(this).attr("data-index")), true);
									return false;	
								});
							}
							
							if($(".file_edit").length>0){
//								if($("head").html().indexOf("zyPopup")<0){  // 代表没有加载过js和css文件
//									// 动态引入裁剪的js和css文件
//									$("<link>").attr({ rel: "stylesheet",
//								        type: "text/css",
//								        href: "zyPopup/css/zyPopup.css"
//								    }).appendTo("head");
//									$.getScript("zyPopup/js/zyPopup.js", function(){
//										// 编辑方法
//										$(".file_edit").click(function() {
//											// 获取选择的文件索引
//											var imgIndex = $(this).attr("data-index");
//											var imgName = $(this).prev(".file_name").attr("title");
//											var imgSrc = $("#uploadImage_"+imgIndex).attr("src");
//											// 打开弹出层
//											self.createPopupPlug(imgSrc, imgIndex, imgName);
//											return false;	
//										});
//									});
//								}else{  // 加载过js和css文件
									// 编辑方法
									$(".file_edit").click(function() {
										// 获取选择的文件索引
										var imgIndex = $(this).attr("data-index");
										var imgName = $(this).prev(".file_name").attr("title");
										var imgSrc = $("#uploadImage_"+imgIndex).attr("src");
										// 打开弹出层
										self.createPopupPlug(imgSrc, imgIndex, imgName);
										return false;	
									});
//								}
							}
						};
						
						// 绑定显示操作栏事件
						var funBindHoverEvent = function(){
							$(".upload_append_list").hover(
								function (e) {
									$(this).find(".file_bar").addClass("file_hover");
								},function (e) {
									$(this).find(".file_bar").removeClass("file_hover");
								}
							);
						};
						
						funDealtPreviewHtml();		
					},
					onDelete: function(file, files) {
						para.onDelete(file, files);  // 回调方法
						// 移除效果
						$("#uploadList_" + file.index).fadeOut();
						// 重新设置统计栏信息
						self.funSetStatusInfo(files);
						console.info("剩下的文件");
						console.info(files);
					},
					onProgress: function(file, loaded, total) {
						var eleProgress = $("#uploadProgress_" + file.index), percent = (loaded / total * 100).toFixed(2) + '%';
						if(eleProgress.is(":hidden")){
							eleProgress.show();
						}
						eleProgress.css("width",percent);
					},
					onSuccess: function(file, response) {
						para.onSuccess(file, response);  // 回调方法
						$("#uploadProgress_" + file.index).hide();
						$("#uploadSuccess_" + file.index).show();
						//$("#uploadInf").append("<p>上传成功，文件地址是：" + response + "</p>");
						// 根据配置参数确定隐不隐藏上传成功的文件
						if(para.finishDel){
							// 移除效果
							$("#uploadList_" + file.index).fadeOut();
							// 重新设置统计栏信息
							self.funSetStatusInfo(ZYFILE.funReturnNeedFiles());
						}
						if($("#uploadTailor_"+file.index).length>0){
							$("#uploadTailor_" + file.index).hide();
						}
					},
					onFailure: function(file, response) {
						para.onFailure(file, response);  // 回调方法
						$("#uploadProgress_" + file.index).hide();
						$("#uploadSuccess_" + file.index).show();
						if($("#uploadTailor_"+file.index).length>0){
							$("#uploadTailor_" + file.index).hide();
						}
						$("#uploadInf").append("<p>文件" + file.name + "上传失败！</p>");	
						//$("#uploadImage_" + file.index).css("opacity", 0.2);
					},
					onComplete: function(response){
						para.onComplete(response);  // 回调方法
						console.info(response);
					},
					onDragOver: function() {
						$(this).addClass("upload_drag_hover");
					},
					onDragLeave: function() {
						$(this).removeClass("upload_drag_hover");
					}

				};
				
				ZYFILE = $.extend(ZYFILE, params);
				ZYFILE.init();
			};
			
			/**
			 * 功能：绑定事件
			 * 参数: 无
			 * 返回: 无
			 */
			this.addEvent = function(){
				// 如果快捷添加文件按钮存在
				if($(".filePicker").length > 0){
					// 绑定选择事件
					$(".filePicker").bind("click", function(e){
		            	$("#fileImage").click();
		            });
				}
	            
				// 绑定继续添加点击事件
				$(".webuploader_pick").bind("click", function(e){
	            	$("#fileImage").click();
	            });
				
				// 绑定上传点击事件
				$(".upload_btn").bind("click", function(e){
					// 判断当前是否有文件需要上传
					if(ZYFILE.funReturnNeedFiles().length > 0){
						$("#fileSubmit").click();
					}else{
						alert("请先选中文件再点击上传");
					}
	            });
				
				// 如果快捷添加文件按钮存在
				if($("#rapidAddImg").length > 0){
					// 绑定添加点击事件
					$("#rapidAddImg").bind("click", function(e){
						$("#fileImage").click();
		            });
				}
			};
			
			
			// 初始化上传控制层插件
			this.init();
		});
	};
})(jQuery);

