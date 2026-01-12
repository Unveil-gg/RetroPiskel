/**
 * Controller for Sega Dreamcast PVR texture export.
 *
 * Supports two export modes:
 *   1. PVR (Twiddled): Ready for direct use with KallistiOS
 *   2. Raw 16-bit: Linear pixel data for custom pipelines
 *
 * Pixel formats supported:
 *   - ARGB1555: 1-bit alpha, 5-5-5 RGB (sprites with sharp transparency)
 *   - RGB565: 5-6-5 RGB, no alpha (opaque textures)
 *   - ARGB4444: 4-bit alpha, 4-4-4 RGB (smooth alpha blending)
 *
 * PVR file structure:
 *   - GBIX header (optional): 16 bytes with global texture index
 *   - PVRT header: 16 bytes with format and dimensions
 *   - Pixel data: Twiddled (Morton order) for GPU efficiency
 *
 * References:
 *   - https://segaretro.org/images/7/78/DreamcastDevBoxSystemArchitecture.pdf
 *   - https://dreamcast.wiki/Twiddling
 *   - https://github.com/KallistiOS/KallistiOS
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');
  var DC = pskl.consoles.DreamcastConstants;

  ns.DreamcastPvrExportController = function (piskelController) {
    this.piskelController = piskelController;
  };

  pskl.utils.inherit(ns.DreamcastPvrExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.DreamcastPvrExportController.prototype.init = function () {
    // Format selector
    this.formatSelect = document.querySelector('.dreamcast-format-select');

    // Checkboxes
    this.twiddleCheckbox = document.querySelector('.dreamcast-twiddle-checkbox');
    this.gbixCheckbox = document.querySelector('.dreamcast-gbix-checkbox');

    // Buttons
    var downloadBtn = document.querySelector('.dreamcast-download-button');
    var rawBtn = document.querySelector('.dreamcast-download-raw-button');

    this.addEventListener(downloadBtn, 'click', this.onDownloadPvrClick_);
    this.addEventListener(rawBtn, 'click', this.onDownloadRawClick_);

    // Initial validation
    this.validateAndDisplay_();

    // Listen for dimension changes
    $.subscribe(Events.PISKEL_RESET, this.validateAndDisplay_.bind(this));
    $.subscribe(Events.FRAME_SIZE_CHANGED, this.validateAndDisplay_.bind(this));
  };

  /**
   * Validates dimensions and updates the UI display.
   * @private
   */
  ns.DreamcastPvrExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();

    var dcMode = pskl.app.consoleRegistry.get('dreamcast');
    var issues = dcMode ? dcMode.validateDimensions(width, height) : [];

    // Show/hide dimension warning
    var warning = document.querySelector('.dreamcast-dimension-warning');
    if (warning) {
      if (issues.length > 0) {
        var messages = issues.map(function (issue) {
          var msg = issue.message;
          if (issue.suggestion) {
            msg += ' (suggest: ' + issue.suggestion + ')';
          }
          return msg;
        });
        warning.querySelector('.dreamcast-warning-message').innerHTML =
          messages.join('<br>');
        warning.style.display = 'flex';
        warning.classList.add('error');
      } else {
        warning.style.display = 'none';
        warning.classList.remove('error');
      }
    }

    // Update dimension display
    var dimInfo = document.querySelector('.dreamcast-dimension-info');
    if (dimInfo) {
      dimInfo.innerHTML = width + '×' + height;
    }
  };

  /**
   * Handles PVR download button click.
   * @private
   */
  ns.DreamcastPvrExportController.prototype.onDownloadPvrClick_ = function () {
    var frameCount = this.piskelController.getFrameCount();
    var baseName = this.getPiskelName_();
    var format = this.formatSelect.value;
    var includeTwiddle = this.twiddleCheckbox.checked;
    var includeGbix = this.gbixCheckbox.checked;

    for (var f = 0; f < frameCount; f++) {
      var data = this.generatePvrData_(f, format, includeTwiddle, includeGbix);
      if (data) {
        var fileName = frameCount > 1
          ? baseName + '_' + f + '.pvr'
          : baseName + '.pvr';
        var blob = new Blob([data], {type: 'application/octet-stream'});
        pskl.utils.FileUtils.downloadAsFile(blob, fileName);

        // Delay between downloads to avoid browser blocking
        if (f < frameCount - 1) {
          this.delay_(100);
        }
      }
    }
  };

  /**
   * Handles raw 16-bit download button click.
   * @private
   */
  ns.DreamcastPvrExportController.prototype.onDownloadRawClick_ = function () {
    var frameCount = this.piskelController.getFrameCount();
    var baseName = this.getPiskelName_();
    var format = this.formatSelect.value;

    for (var f = 0; f < frameCount; f++) {
      var data = this.generateRawData_(f, format);
      if (data) {
        var fileName = frameCount > 1
          ? baseName + '_' + f + '.bin'
          : baseName + '.bin';
        var blob = new Blob([data], {type: 'application/octet-stream'});
        pskl.utils.FileUtils.downloadAsFile(blob, fileName);

        if (f < frameCount - 1) {
          this.delay_(100);
        }
      }
    }
  };

  /**
   * Generates complete PVR file data for a frame.
   * @param {number} frameIndex - Frame index to export
   * @param {string} format - Pixel format ('ARGB1555', 'RGB565', 'ARGB4444')
   * @param {boolean} twiddle - Whether to twiddle pixel data
   * @param {boolean} includeGbix - Whether to include GBIX header
   * @return {ArrayBuffer} Complete PVR file data
   * @private
   */
  ns.DreamcastPvrExportController.prototype.generatePvrData_ = function (
    frameIndex, format, twiddle, includeGbix
  ) {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();

    // Get pixel data
    var pixels = this.getFramePixels_(frameIndex, format);

    // Twiddle if requested
    var dcMode = pskl.app.consoleRegistry.get('dreamcast');
    if (twiddle && dcMode) {
      pixels = dcMode.twiddlePixels(pixels, width, height);
    }

    // Calculate buffer size
    var headerSize = includeGbix
      ? DC.GBIX_HEADER_SIZE + DC.PVRT_HEADER_SIZE
      : DC.PVRT_HEADER_SIZE;
    var dataSize = width * height * DC.BYTES_PER_PIXEL;
    var totalSize = headerSize + dataSize;

    var buffer = new ArrayBuffer(totalSize);
    var view = new DataView(buffer);
    var offset = 0;

    // Write GBIX header if requested
    if (includeGbix) {
      view.setUint32(offset, DC.GBIX_MAGIC, true);  // "GBIX"
      offset += 4;
      view.setUint32(offset, 8, true);              // Section size
      offset += 4;
      view.setUint32(offset, frameIndex, true);    // Global index
      offset += 4;
      view.setUint32(offset, 0, true);              // Padding
      offset += 4;
    }

    // Write PVRT header
    view.setUint32(offset, DC.PVRT_MAGIC, true);   // "PVRT"
    offset += 4;
    view.setUint32(offset, dataSize, true);        // Data size
    offset += 4;

    // Pixel format byte
    var pixelFormatCode = this.getPixelFormatCode_(format);
    view.setUint8(offset, pixelFormatCode);
    offset += 1;

    // Data format byte
    var dataFormatCode = twiddle
      ? DC.DATA_FORMAT_TWIDDLED
      : DC.DATA_FORMAT_RECTANGLE;
    view.setUint8(offset, dataFormatCode);
    offset += 1;

    // Reserved (2 bytes)
    view.setUint16(offset, 0, true);
    offset += 2;

    // Width and height
    view.setUint16(offset, width, true);
    offset += 2;
    view.setUint16(offset, height, true);
    offset += 2;

    // Write pixel data
    var pixelView = new Uint16Array(buffer, offset);
    pixelView.set(pixels);

    return buffer;
  };

  /**
   * Generates raw 16-bit pixel data for a frame (no header, no twiddling).
   * @param {number} frameIndex - Frame index to export
   * @param {string} format - Pixel format
   * @return {ArrayBuffer} Raw pixel data
   * @private
   */
  ns.DreamcastPvrExportController.prototype.generateRawData_ = function (
    frameIndex, format
  ) {
    var pixels = this.getFramePixels_(frameIndex, format);
    return pixels.buffer;
  };

  /**
   * Gets frame pixels converted to the specified 16-bit format.
   * @param {number} frameIndex - Frame index
   * @param {string} format - Pixel format
   * @return {Uint16Array} Converted pixel data
   * @private
   */
  ns.DreamcastPvrExportController.prototype.getFramePixels_ = function (
    frameIndex, format
  ) {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();

    var render = this.piskelController.renderFrameAt(frameIndex, true);
    var ctx = render.getContext('2d');
    var imgData = ctx.getImageData(0, 0, width, height);
    var rgba = imgData.data;

    var dcMode = pskl.app.consoleRegistry.get('dreamcast');
    var pixels = new Uint16Array(width * height);

    for (var i = 0; i < width * height; i++) {
      var r = rgba[i * 4 + 0];
      var g = rgba[i * 4 + 1];
      var b = rgba[i * 4 + 2];
      var a = rgba[i * 4 + 3];

      var pixel;
      if (dcMode) {
        switch (format) {
          case 'ARGB1555':
            pixel = dcMode.toARGB1555(r, g, b, a);
            break;
          case 'RGB565':
            pixel = dcMode.toRGB565(r, g, b);
            break;
          case 'ARGB4444':
            pixel = dcMode.toARGB4444(r, g, b, a);
            break;
          default:
            pixel = dcMode.toARGB1555(r, g, b, a);
        }
      } else {
        // Fallback without console mode
        pixel = this.toARGB1555Fallback_(r, g, b, a);
      }

      pixels[i] = pixel;
    }

    return pixels;
  };

  /**
   * Fallback ARGB1555 conversion if console mode unavailable.
   * @private
   */
  ns.DreamcastPvrExportController.prototype.toARGB1555Fallback_ = function (
    r, g, b, a
  ) {
    var alpha = (a >= 128) ? 1 : 0;
    var r5 = Math.round(r * 31 / 255);
    var g5 = Math.round(g * 31 / 255);
    var b5 = Math.round(b * 31 / 255);
    return (alpha << 15) | (r5 << 10) | (g5 << 5) | b5;
  };

  /**
   * Gets the PVR pixel format code for a format name.
   * @param {string} format - Format name
   * @return {number} PVR format code
   * @private
   */
  ns.DreamcastPvrExportController.prototype.getPixelFormatCode_ = function (
    format
  ) {
    switch (format) {
      case 'ARGB1555': return DC.PIXEL_FORMAT_ARGB1555;
      case 'RGB565': return DC.PIXEL_FORMAT_RGB565;
      case 'ARGB4444': return DC.PIXEL_FORMAT_ARGB4444;
      default: return DC.PIXEL_FORMAT_ARGB1555;
    }
  };

  /**
   * Simple delay helper for sequential downloads.
   * @param {number} ms - Milliseconds to delay
   * @private
   */
  ns.DreamcastPvrExportController.prototype.delay_ = function (ms) {
    var start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait (not ideal but works for short delays)
    }
  };

  /**
   * Gets the current piskel name for filenames.
   * @return {string} Piskel name
   * @private
   */
  ns.DreamcastPvrExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();
