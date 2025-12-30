(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /**
   * Orchestrator controller for miscellaneous export formats.
   * Delegates to specialized exporters: BMP, C, and SVG.
   * @param {Object} piskelController - The piskel controller instance
   */
  ns.MiscExportController = function (piskelController) {
    this.piskelController = piskelController;

    // Initialize specialized exporters
    this.bmpExporter = new ns.BmpExporter(piskelController);
    this.cExporter = new ns.CExporter(piskelController);
    this.svgExporter = new ns.SvgExporter(piskelController);
  };

  pskl.utils.inherit(ns.MiscExportController,
    pskl.controller.settings.AbstractSettingController);

  /**
   * Initializes all exporters by calling their init methods.
   */
  ns.MiscExportController.prototype.init = function () {
    this.bmpExporter.init();
    this.cExporter.init();
    this.svgExporter.init();
  };
})();
