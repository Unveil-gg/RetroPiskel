/**
 * Controller for CHR (NES/Famicom 2-bit tile) export.
 *
 * CHR format: 16 bytes per 8x8 tile
 *   - Bytes 0-7: Channel 1 (bit 0 of color index)
 *   - Bytes 8-15: Channel 2 (bit 1 of color index)
 *
 * Reference: https://wiki.xxiivv.com/site/chr_format.html
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  ns.ChrExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.colorMap = {};  // Maps color int -> index (0-3)
  };

  pskl.utils.inherit(ns.ChrExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.ChrExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var downloadBtn = document.querySelector('.chr-download-button');
    this.addEventListener(downloadBtn, 'click', this.onDownloadClick_);

    // Listen for color changes to update validation
    $.subscribe(Events.CURRENT_COLORS_UPDATED,
      this.validateAndDisplay_.bind(this));
  };

  /**
   * Validates current sprite and updates the UI.
   * @private
   */
  ns.ChrExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();

    // Dimension validation
    var dimContainer = document.querySelector('.chr-validation-dimensions');
    var dimValid = width % 8 === 0 && height % 8 === 0;

    if (dimValid) {
      var tilesX = width / 8;
      var tilesY = height / 8;
      var totalTiles = tilesX * tilesY;
      var tileSuffix = (totalTiles > 1 ? 's' : '');
      dimContainer.innerHTML = '✓ ' + width + '×' + height +
        ' (' + totalTiles + ' tile' + tileSuffix + ')';
      dimContainer.className =
        'chr-validation-item chr-validation-dimensions valid';
    } else {
      dimContainer.innerHTML = '✗ Dimensions must be multiples of 8';
      dimContainer.className =
        'chr-validation-item chr-validation-dimensions invalid';
    }

    // Color validation
    var colors = pskl.app.currentColorsService.getCurrentColors();
    var colorContainer = document.querySelector('.chr-validation-colors');
    var colorCount = colors.length;

    if (colorCount <= 3) {
      colorContainer.innerHTML = '✓ ' + colorCount + '/3 colors used';
      colorContainer.className =
        'chr-validation-item chr-validation-colors valid';
    } else {
      colorContainer.innerHTML = '✗ Too many colors: ' + colorCount +
        '/3 (max 3 + transparent)';
      colorContainer.className =
        'chr-validation-item chr-validation-colors invalid';
    }

    // Update palette slot previews
    this.updatePaletteSlots_(colors);

    // Enable/disable download button
    var downloadBtn = document.querySelector('.chr-download-button');
    var canExport = dimValid && colorCount <= 3;
    downloadBtn.disabled = !canExport;

    // Update download info text
    var downloadInfo = document.querySelector('.chr-download-info');
    if (canExport) {
      var frameCount = this.piskelController.getFrameCount();
      var totalBytes = frameCount * (width / 8) * (height / 8) * 16;
      downloadInfo.innerHTML = totalBytes + ' bytes' +
        (frameCount > 1 ? ' (' + frameCount + ' frames)' : '');
    } else {
      downloadInfo.innerHTML = 'Fix validation errors to export.';
    }
  };

  /**
   * Updates the color slot UI to show current colors.
   * @param {Array} colors - Array of hex color strings
   * @private
   */
  ns.ChrExportController.prototype.updatePaletteSlots_ = function (colors) {
    // Reset color map - index 0 is always transparent
    this.colorMap = {};
    this.colorMap[0] = 0;  // Transparent (alpha = 0) maps to index 0

    // Map each color to an index 1-3
    for (var i = 0; i < Math.min(colors.length, 3); i++) {
      var slot = document.querySelector('[data-slot="' + (i + 1) + '"]');
      if (slot) {
        slot.style.backgroundColor = colors[i];
      }
      // Store the int value for fast lookup during export
      var colorInt = pskl.utils.colorToInt(colors[i]);
      this.colorMap[colorInt] = i + 1;
    }

    // Clear unused slots
    for (var j = colors.length; j < 3; j++) {
      var emptySlot = document.querySelector('[data-slot="' + (j + 1) + '"]');
      if (emptySlot) {
        emptySlot.style.backgroundColor = '#333';
      }
    }
  };

  /**
   * Handles download button click.
   * @private
   */
  ns.ChrExportController.prototype.onDownloadClick_ = function () {
    var chrData = this.generateChrData_();
    if (chrData) {
      var fileName = this.getPiskelName_() + '.chr';
      var blob = new Blob([chrData], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Generates the binary CHR data for all frames.
   * @return {Uint8Array} The CHR file bytes
   * @private
   */
  ns.ChrExportController.prototype.generateChrData_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var tilesX = width / 8;
    var tilesY = height / 8;
    var tilesPerFrame = tilesX * tilesY;
    var totalBytes = frameCount * tilesPerFrame * 16;

    var chrBytes = new Uint8Array(totalBytes);
    var byteIndex = 0;

    for (var f = 0; f < frameCount; f++) {
      var render = this.piskelController.renderFrameAt(f, true);
      var ctx = render.getContext('2d');
      var imgData = ctx.getImageData(0, 0, width, height);
      var pixels = imgData.data;

      // Process each 8x8 tile (row by row, left to right)
      for (var tileY = 0; tileY < tilesY; tileY++) {
        for (var tileX = 0; tileX < tilesX; tileX++) {
          var tileBytes = this.encodeTile_(pixels, width, tileX * 8, tileY * 8);
          chrBytes.set(tileBytes, byteIndex);
          byteIndex += 16;
        }
      }
    }

    return chrBytes;
  };

  /**
   * Encodes a single 8x8 tile to 16 bytes in CHR format.
   *
   * CHR format stores two bitplanes:
   *   - First 8 bytes: bit 0 of each pixel's color index
   *   - Next 8 bytes: bit 1 of each pixel's color index
   *
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 16 bytes for this tile
   * @private
   */
  ns.ChrExportController.prototype.encodeTile_ = function (
    pixels, imgWidth, startX, startY
  ) {
    var channel1 = new Uint8Array(8);  // Bit 0 of color index
    var channel2 = new Uint8Array(8);  // Bit 1 of color index

    for (var y = 0; y < 8; y++) {
      var ch1Byte = 0;
      var ch2Byte = 0;

      for (var x = 0; x < 8; x++) {
        var px = startX + x;
        var py = startY + y;
        var idx = (py * imgWidth + px) * 4;

        var r = pixels[idx];
        var g = pixels[idx + 1];
        var b = pixels[idx + 2];
        var a = pixels[idx + 3];

        // Get color index (0-3)
        var colorIndex = this.getColorIndex_(r, g, b, a);

        // Set bits (MSB first: bit 7 = leftmost pixel x=0)
        var bitPos = 7 - x;
        ch1Byte |= ((colorIndex & 1) << bitPos);
        ch2Byte |= (((colorIndex >> 1) & 1) << bitPos);
      }

      channel1[y] = ch1Byte;
      channel2[y] = ch2Byte;
    }

    // Combine: channel1 (8 bytes) followed by channel2 (8 bytes)
    var tile = new Uint8Array(16);
    tile.set(channel1, 0);
    tile.set(channel2, 8);

    return tile;
  };

  /**
   * Maps an RGBA pixel to a color index 0-3.
   * @param {number} r - Red component (0-255)
   * @param {number} g - Green component (0-255)
   * @param {number} b - Blue component (0-255)
   * @param {number} a - Alpha component (0-255)
   * @return {number} Color index 0-3
   * @private
   */
  ns.ChrExportController.prototype.getColorIndex_ = function (r, g, b, a) {
    // Transparent pixels -> index 0
    if (a < 128) {
      return 0;
    }

    // Convert RGBA to int format used by Piskel
    var colorInt = (255 << 24 >>> 0) + (b << 16) + (g << 8) + r;

    if (this.colorMap.hasOwnProperty(colorInt)) {
      return this.colorMap[colorInt];
    }

    // Color not in map - this shouldn't happen if validation passed
    // Default to index 1 as fallback
    console.warn('Unmapped color during CHR export:', r, g, b);
    return 1;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.ChrExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();
