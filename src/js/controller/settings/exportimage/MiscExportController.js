(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  var BLACK = '#000000';

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
})();
