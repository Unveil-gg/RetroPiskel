(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  var DEFAULT_FPS = 12;

  /**
   * SVG exporter for piskel frames.
   * Exports single frame as static SVG or multiple frames as animated SVG.
   * @param {Object} piskelController - The piskel controller instance
   */
  ns.SvgExporter = function (piskelController) {
    this.piskelController = piskelController;
  };

  pskl.utils.inherit(ns.SvgExporter,
    pskl.controller.settings.AbstractSettingController);

  /**
   * Initializes the SVG exporter by binding UI events.
   */
  ns.SvgExporter.prototype.init = function () {
    var downloadButton = document.querySelector('.svg-download-button');
    this.addEventListener(downloadButton, 'click', this.onDownloadClick_);

    this.loopCheckbox = document.querySelector('.svg-loop-checkbox');
    this.loopCheckbox.checked = this.getLoopSetting_();
    this.addEventListener(this.loopCheckbox, 'change',
      this.onLoopCheckboxChange_);

    // Hide loop option if single frame
    this.updateLoopVisibility_();
  };

  /**
   * Hides loop checkbox when only one frame exists.
   * @private
   */
  ns.SvgExporter.prototype.updateLoopVisibility_ = function () {
    var loopRow = document.querySelector('.svg-loop-row');
    if (loopRow) {
      var hasMultipleFrames = this.piskelController.getFrameCount() > 1;
      loopRow.style.display = hasMultipleFrames ? 'block' : 'none';
    }
  };

  /**
   * Handles SVG loop checkbox change.
   * @private
   */
  ns.SvgExporter.prototype.onLoopCheckboxChange_ = function () {
    var checked = this.loopCheckbox.checked;
    pskl.UserSettings.set(pskl.UserSettings.EXPORT_SVG_LOOP, checked);
  };

  /**
   * Gets SVG loop setting from user settings.
   * @return {boolean} True if loop is enabled
   * @private
   */
  ns.SvgExporter.prototype.getLoopSetting_ = function () {
    return pskl.UserSettings.get(pskl.UserSettings.EXPORT_SVG_LOOP);
  };

  /**
   * Handles SVG download button click.
   * Exports current piskel as SVG (animated if multiple frames).
   * @private
   */
  ns.SvgExporter.prototype.onDownloadClick_ = function () {
    var frameCount = this.piskelController.getFrameCount();
    var svgContent;

    if (frameCount === 1) {
      svgContent = this.generateStaticSvg_();
    } else {
      svgContent = this.generateAnimatedSvg_();
    }

    var fileName = this.getPiskelName_() + '.svg';
    pskl.utils.BlobUtils.stringToBlob(svgContent, function (blob) {
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }, 'image/svg+xml');
  };

  /**
   * Gets the piskel name for file naming.
   * @return {string} Piskel name
   * @private
   */
  ns.SvgExporter.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };

  /**
   * Generates a static SVG for a single frame.
   * Uses CSS classes for color deduplication.
   * @return {string} SVG markup
   * @private
   */
  ns.SvgExporter.prototype.generateStaticSvg_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var canvas = this.piskelController.renderFrameAt(0, true);
    var ctx = canvas.getContext('2d');
    var imgData = ctx.getImageData(0, 0, width, height);
    var pixels = imgData.data;

    var colorMap = {};
    var colorIndex = 0;
    var rects = [];

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = (y * width + x) * 4;
        var r = pixels[i];
        var g = pixels[i + 1];
        var b = pixels[i + 2];
        var a = pixels[i + 3];

        // Skip fully transparent pixels
        if (a === 0) {
          continue;
        }

        var colorKey = this.rgbaToSvgColor_(r, g, b, a);
        if (!(colorKey in colorMap)) {
          colorMap[colorKey] = 'c' + colorIndex++;
        }

        rects.push({x: x, y: y, colorClass: colorMap[colorKey]});
      }
    }

    return this.buildSvgDocument_(width, height, colorMap, rects);
  };

  /**
   * Generates an animated SVG using SMIL for multiple frames.
   * Each frame is a <g> with visibility animated.
   * @return {string} SVG markup
   * @private
   */
  ns.SvgExporter.prototype.generateAnimatedSvg_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();
    var fps = this.piskelController.getFPS() || DEFAULT_FPS;
    var loop = this.getLoopSetting_();

    var totalDuration = frameCount / fps;
    var colorMap = {};
    var colorIndex = 0;
    var frameGroups = [];

    // Process each frame
    for (var f = 0; f < frameCount; f++) {
      var canvas = this.piskelController.renderFrameAt(f, true);
      var ctx = canvas.getContext('2d');
      var imgData = ctx.getImageData(0, 0, width, height);
      var pixels = imgData.data;
      var rects = [];

      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          var i = (y * width + x) * 4;
          var r = pixels[i];
          var g = pixels[i + 1];
          var b = pixels[i + 2];
          var a = pixels[i + 3];

          if (a === 0) {
            continue;
          }

          var colorKey = this.rgbaToSvgColor_(r, g, b, a);
          if (!(colorKey in colorMap)) {
            colorMap[colorKey] = 'c' + colorIndex++;
          }

          rects.push({x: x, y: y, colorClass: colorMap[colorKey]});
        }
      }

      frameGroups.push(rects);
    }

    return this.buildAnimatedSvgDocument_(width, height, colorMap, frameGroups,
      totalDuration, loop);
  };

  /**
   * Converts RGBA values to SVG-compatible color string.
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @param {number} a - Alpha (0-255)
   * @return {string} CSS color value
   * @private
   */
  ns.SvgExporter.prototype.rgbaToSvgColor_ = function (r, g, b, a) {
    if (a === 255) {
      // Use hex for fully opaque colors (shorter)
      return '#' +
        ('0' + r.toString(16)).slice(-2) +
        ('0' + g.toString(16)).slice(-2) +
        ('0' + b.toString(16)).slice(-2);
    }
    // Use rgba for semi-transparent
    var alpha = (a / 255).toFixed(3).replace(/\.?0+$/, '');
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  };

  /**
   * Builds complete SVG document for static export.
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {Object} colorMap - Map of color string to class name
   * @param {Array} rects - Array of rect objects {x, y, colorClass}
   * @return {string} Complete SVG document
   * @private
   */
  ns.SvgExporter.prototype.buildSvgDocument_ = function (
    width, height, colorMap, rects) {
    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" ';
    svg += 'viewBox="0 0 ' + width + ' ' + height + '" ';
    svg += 'width="' + width + '" height="' + height + '" ';
    svg += 'shape-rendering="crispEdges">\n';

    // Style block with color classes
    svg += '<style>\n';
    for (var color in colorMap) {
      if (colorMap.hasOwnProperty(color)) {
        svg += '.' + colorMap[color] + '{fill:' + color + '}\n';
      }
    }
    svg += '</style>\n';

    // Rectangles
    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];
      svg += '<rect x="' + rect.x + '" y="' + rect.y + '" ';
      svg += 'width="1" height="1" class="' + rect.colorClass + '"/>\n';
    }

    svg += '</svg>';
    return svg;
  };

  /**
   * Builds animated SVG document using SMIL.
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {Object} colorMap - Map of color string to class name
   * @param {Array} frameGroups - Array of frame rect arrays
   * @param {number} duration - Total animation duration in seconds
   * @param {boolean} loop - Whether to loop indefinitely
   * @return {string} Complete animated SVG document
   * @private
   */
  ns.SvgExporter.prototype.buildAnimatedSvgDocument_ = function (
    width, height, colorMap, frameGroups, duration, loop) {
    var frameCount = frameGroups.length;
    var repeatCount = loop ? 'indefinite' : '1';

    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n';
    svg += '<svg xmlns="http://www.w3.org/2000/svg" ';
    svg += 'viewBox="0 0 ' + width + ' ' + height + '" ';
    svg += 'width="' + width + '" height="' + height + '" ';
    svg += 'shape-rendering="crispEdges">\n';

    // Style block with color classes
    svg += '<style>\n';
    for (var color in colorMap) {
      if (colorMap.hasOwnProperty(color)) {
        svg += '.' + colorMap[color] + '{fill:' + color + '}\n';
      }
    }
    svg += '</style>\n';

    // Generate frame groups with SMIL animation
    for (var f = 0; f < frameCount; f++) {
      var rects = frameGroups[f];
      var visibility = this.buildVisibilityValues_(f, frameCount);
      var keyTimes = this.buildKeyTimes_(frameCount);

      svg += '<g id="frame' + f + '">\n';
      svg += '  <animate attributeName="visibility" ';
      svg += 'values="' + visibility + '" ';
      svg += 'keyTimes="' + keyTimes + '" ';
      svg += 'dur="' + duration.toFixed(3) + 's" ';
      svg += 'repeatCount="' + repeatCount + '" ';
      svg += 'calcMode="discrete" fill="freeze"/>\n';

      for (var i = 0; i < rects.length; i++) {
        var rect = rects[i];
        svg += '  <rect x="' + rect.x + '" y="' + rect.y + '" ';
        svg += 'width="1" height="1" class="' + rect.colorClass + '"/>\n';
      }

      svg += '</g>\n';
    }

    svg += '</svg>';
    return svg;
  };

  /**
   * Builds visibility values string for SMIL animate.
   * @param {number} frameIndex - Current frame index
   * @param {number} frameCount - Total frame count
   * @return {string} Semicolon-separated visibility values
   * @private
   */
  ns.SvgExporter.prototype.buildVisibilityValues_ = function (
    frameIndex, frameCount) {
    var values = [];
    for (var i = 0; i < frameCount; i++) {
      values.push(i === frameIndex ? 'visible' : 'hidden');
    }
    return values.join(';');
  };

  /**
   * Builds keyTimes string for SMIL animate.
   * @param {number} frameCount - Total frame count
   * @return {string} Semicolon-separated keyTime values (0 to 1)
   * @private
   */
  ns.SvgExporter.prototype.buildKeyTimes_ = function (frameCount) {
    var times = [];
    for (var i = 0; i < frameCount; i++) {
      times.push((i / frameCount).toFixed(4));
    }
    return times.join(';');
  };
})();
