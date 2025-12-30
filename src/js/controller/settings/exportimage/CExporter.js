(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /**
   * C file exporter for piskel frames.
   * Exports frames as a C header file with pixel data arrays.
   * @param {Object} piskelController - The piskel controller instance
   */
  ns.CExporter = function (piskelController) {
    this.piskelController = piskelController;
  };

  pskl.utils.inherit(ns.CExporter,
    pskl.controller.settings.AbstractSettingController);

  /**
   * Initializes the C exporter by binding UI events.
   */
  ns.CExporter.prototype.init = function () {
    var downloadButton = document.querySelector('.c-download-button');
    this.addEventListener(downloadButton, 'click', this.onDownloadClick_);
  };

  /**
   * Handles C file download button click.
   * Exports all frames as a C header file with pixel data.
   * @private
   */
  ns.CExporter.prototype.onDownloadClick_ = function () {
    var fileName = this.getPiskelName_() + '.c';
    var cName = this.getPiskelName_().replace(' ', '_');
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Useful defines for C routines
    var frameStr = '#include <stdint.h>\n\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_COUNT ';
    frameStr += frameCount + '\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_WIDTH ';
    frameStr += width + '\n';
    frameStr += '#define ' + cName.toUpperCase() + '_FRAME_HEIGHT ';
    frameStr += height + '\n\n';

    frameStr += '/* Piskel data for \"' + this.getPiskelName_() + '\" */\n\n';

    frameStr += 'static const uint32_t ' + cName.toLowerCase();
    frameStr += '_data[' + frameCount + '][' + width * height + '] = {\n';

    for (var i = 0; i < frameCount; i++) {
      var render = this.piskelController.renderFrameAt(i, true);
      var context = render.getContext('2d');
      var imgd = context.getImageData(0, 0, width, height);
      var pix = imgd.data;

      frameStr += '{\n';
      for (var j = 0; j < pix.length; j += 4) {
        frameStr += this.rgbToCHex_(pix[j], pix[j + 1], pix[j + 2], pix[j + 3]);
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
    pskl.utils.BlobUtils.stringToBlob(frameStr, function (blob) {
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }.bind(this), 'application/text');
  };

  /**
   * Gets the piskel name for file naming.
   * @return {string} Piskel name
   * @private
   */
  ns.CExporter.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };

  /**
   * Converts RGBA values to C hex format.
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @param {number} a - Alpha (0-255)
   * @return {string} C hex string (e.g., 0xAABBGGRR)
   * @private
   */
  ns.CExporter.prototype.rgbToCHex_ = function (r, g, b, a) {
    var hexStr = '0x';
    hexStr += ('00' + a.toString(16)).substr(-2);
    hexStr += ('00' + b.toString(16)).substr(-2);
    hexStr += ('00' + g.toString(16)).substr(-2);
    hexStr += ('00' + r.toString(16)).substr(-2);
    return hexStr;
  };
})();

