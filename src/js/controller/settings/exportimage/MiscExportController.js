(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  var BLACK = '#000000';
  var DEFAULT_FPS = 12;

  // BMP format constants for 32-bit BGRA export
  var BMP_FILE_HEADER_SIZE = 14;
  var BMP_V4_HEADER_SIZE = 108;
  var BMP_HEADER_TOTAL = BMP_FILE_HEADER_SIZE + BMP_V4_HEADER_SIZE;

  ns.MiscExportController = function (piskelController) {
    this.piskelController = piskelController;
  };

  pskl.utils.inherit(ns.MiscExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.MiscExportController.prototype.init = function () {
    var cDownloadButton = document.querySelector('.c-download-button');
    this.addEventListener(cDownloadButton, 'click', this.onDownloadCFileClick_);

    var bmpDownloadButton = document.querySelector('.bmp-download-button');
    this.addEventListener(bmpDownloadButton, 'click', this.onDownloadBmpClick_);

    var svgDownloadButton = document.querySelector('.svg-download-button');
    this.addEventListener(svgDownloadButton, 'click', this.onDownloadSvgClick_);

    this.svgLoopCheckbox = document.querySelector('.svg-loop-checkbox');
    this.svgLoopCheckbox.checked = this.getSvgLoopSetting_();
    this.addEventListener(this.svgLoopCheckbox, 'change',
      this.onSvgLoopCheckboxChange_);

    // Hide loop option if single frame
    this.updateSvgLoopVisibility_();
  };

  /**
   * Handles BMP download button click.
   * Exports all frames as 32-bit BMP files in a ZIP archive.
   * @private
   */
  ns.MiscExportController.prototype.onDownloadBmpClick_ = function () {
    var zip = new window.JSZip();
    var frameCount = this.piskelController.getFrameCount();
    var paddingLength = ('' + frameCount).length;
    var baseName = this.getPiskelName_();

    for (var i = 0; i < frameCount; i++) {
      var canvas = this.piskelController.renderFrameAt(i, true);
      var bmpData = this.generateBmpData_(canvas);
      var frameId = pskl.utils.StringUtils.leftPad(i, paddingLength, '0');
      var fileName = baseName + '_' + frameId + '.bmp';
      zip.file(fileName, bmpData);
    }

    var zipFileName = baseName + '_bmp.zip';
    var blob = zip.generate({type: 'blob'});
    pskl.utils.FileUtils.downloadAsFile(blob, zipFileName);
  };

  /**
   * Generates 32-bit BGRA BMP data from a canvas element.
   *
   * BMP 32-bit format with BITMAPV4HEADER:
   *   - File Header: 14 bytes (signature, file size, pixel data offset)
   *   - DIB Header: 108 bytes (BITMAPV4HEADER with RGBA channel masks)
   *   - Pixel Data: width * height * 4 bytes (BGRA order, top-down)
   *
   * Uses negative height for top-down row order (avoids row reversal).
   * Channel masks specify BGRA layout for proper alpha support.
   *
   * @param {HTMLCanvasElement} canvas - Source canvas to encode
   * @return {Uint8Array} Complete BMP file as byte array
   * @private
   */
  ns.MiscExportController.prototype.generateBmpData_ = function (canvas) {
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext('2d');
    var imgData = ctx.getImageData(0, 0, width, height);
    var pixels = imgData.data;

    var pixelDataSize = width * height * 4;
    var fileSize = BMP_HEADER_TOTAL + pixelDataSize;
    var bmpData = new Uint8Array(fileSize);
    var view = new DataView(bmpData.buffer);

    // === File Header (14 bytes) ===
    bmpData[0] = 0x42;  // 'B'
    bmpData[1] = 0x4D;  // 'M'
    view.setUint32(2, fileSize, true);       // File size
    view.setUint16(6, 0, true);              // Reserved1
    view.setUint16(8, 0, true);              // Reserved2
    view.setUint32(10, BMP_HEADER_TOTAL, true);  // Pixel data offset

    // === BITMAPV4HEADER (108 bytes) ===
    view.setUint32(14, BMP_V4_HEADER_SIZE, true);  // Header size
    view.setInt32(18, width, true);                // Width
    view.setInt32(22, -height, true);              // Height (negative = top-down)
    view.setUint16(26, 1, true);                   // Planes (always 1)
    view.setUint16(28, 32, true);                  // Bits per pixel (32-bit)
    view.setUint32(30, 3, true);                   // Compression (BI_BITFIELDS)
    view.setUint32(34, pixelDataSize, true);       // Image size
    view.setInt32(38, 2835, true);                 // X pixels per meter (~72 DPI)
    view.setInt32(42, 2835, true);                 // Y pixels per meter (~72 DPI)
    view.setUint32(46, 0, true);                   // Colors used
    view.setUint32(50, 0, true);                   // Important colors

    // Channel masks for BGRA (32-bit with alpha)
    view.setUint32(54, 0x00FF0000, true);   // Red mask
    view.setUint32(58, 0x0000FF00, true);   // Green mask
    view.setUint32(62, 0x000000FF, true);   // Blue mask
    view.setUint32(66, 0xFF000000, true);   // Alpha mask

    // Color space type (LCS_sRGB = 0x73524742)
    view.setUint32(70, 0x73524742, true);

    // CIEXYZTRIPLE endpoints (36 bytes of zeros for sRGB)
    // Offsets 74-109 are already zero from Uint8Array initialization

    // Gamma values (unused for sRGB, leave as zero)
    // Offsets 110-121 are already zero

    // === Pixel Data (BGRA, top-down order) ===
    var offset = BMP_HEADER_TOTAL;
    for (var i = 0; i < pixels.length; i += 4) {
      bmpData[offset++] = pixels[i + 2];  // Blue
      bmpData[offset++] = pixels[i + 1];  // Green
      bmpData[offset++] = pixels[i];      // Red
      bmpData[offset++] = pixels[i + 3];  // Alpha
    }

    return bmpData;
  };

  ns.MiscExportController.prototype.onDownloadCFileClick_ = function (evt) {
    var fileName = this.getPiskelName_() + '.c';
    var cName = this.getPiskelName_().replace(' ','_');
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Useful defines for C routines
    var frameStr = '#include <stdint.h>\n\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_COUNT ' +  this.piskelController.getFrameCount() + '\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_WIDTH ' + width + '\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_HEIGHT ' + height + '\n\n';

    frameStr += '/* Piskel data for \"' + this.getPiskelName_() + '\" */\n\n';

    frameStr += 'static const uint32_t ' + cName.toLowerCase();
    frameStr += '_data[' + frameCount + '][' + width * height + '] = {\n';

    for (var i = 0 ; i < frameCount ; i++) {
      var render = this.piskelController.renderFrameAt(i, true);
      var context = render.getContext('2d');
      var imgd = context.getImageData(0, 0, width, height);
      var pix = imgd.data;

      frameStr += '{\n';
      for (var j = 0; j < pix.length; j += 4) {
        frameStr += this.rgbToCHex(pix[j], pix[j + 1], pix[j + 2], pix[j + 3]);
        if (j != pix.length - 4) {
          frameStr += ', ';
        }
        if (((j + 4) % (width * 4)) === 0) {
          frameStr += '\n';
        }
      }
      if (i != (frameCount - 1)) {
        frameStr += '},\n';
      } else {
        frameStr += '}\n';
      }
    }

    frameStr += '};\n';
    pskl.utils.BlobUtils.stringToBlob(frameStr, function(blob) {
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }.bind(this), 'application/text');
  };

  ns.MiscExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };

  ns.MiscExportController.prototype.rgbToCHex = function (r, g, b, a) {
    var hexStr = '0x';
    hexStr += ('00' + a.toString(16)).substr(-2);
    hexStr += ('00' + b.toString(16)).substr(-2);
    hexStr += ('00' + g.toString(16)).substr(-2);
    hexStr += ('00' + r.toString(16)).substr(-2);
    return hexStr;
  };

  // ========== SVG Export ==========

  /**
   * Hides loop checkbox when only one frame exists.
   * @private
   */
  ns.MiscExportController.prototype.updateSvgLoopVisibility_ = function () {
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
  ns.MiscExportController.prototype.onSvgLoopCheckboxChange_ = function () {
    var checked = this.svgLoopCheckbox.checked;
    pskl.UserSettings.set(pskl.UserSettings.EXPORT_SVG_LOOP, checked);
  };

  /**
   * Gets SVG loop setting from user settings.
   * @return {boolean} True if loop is enabled
   * @private
   */
  ns.MiscExportController.prototype.getSvgLoopSetting_ = function () {
    return pskl.UserSettings.get(pskl.UserSettings.EXPORT_SVG_LOOP);
  };

  /**
   * Handles SVG download button click.
   * Exports current piskel as SVG (animated if multiple frames).
   * @private
   */
  ns.MiscExportController.prototype.onDownloadSvgClick_ = function () {
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
   * Generates a static SVG for a single frame.
   * Uses CSS classes for color deduplication.
   * @return {string} SVG markup
   * @private
   */
  ns.MiscExportController.prototype.generateStaticSvg_ = function () {
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
  ns.MiscExportController.prototype.generateAnimatedSvg_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();
    var fps = this.piskelController.getFPS() || DEFAULT_FPS;
    var loop = this.getSvgLoopSetting_();

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
  ns.MiscExportController.prototype.rgbaToSvgColor_ = function (r, g, b, a) {
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
  ns.MiscExportController.prototype.buildSvgDocument_ = function (
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
  ns.MiscExportController.prototype.buildAnimatedSvgDocument_ = function (
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
  ns.MiscExportController.prototype.buildVisibilityValues_ = function (
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
  ns.MiscExportController.prototype.buildKeyTimes_ = function (frameCount) {
    var times = [];
    for (var i = 0; i < frameCount; i++) {
      times.push((i / frameCount).toFixed(4));
    }
    return times.join(';');
  };
})();
