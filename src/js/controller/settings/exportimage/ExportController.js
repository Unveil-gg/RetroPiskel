(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /**
   * Base export tabs available in all modes.
   */
  var baseTabs = {
    'png' : {
      template : 'templates/settings/export/png.html',
      controller : ns.PngExportController
    },
    'gif' : {
      template : 'templates/settings/export/gif.html',
      controller : ns.GifExportController
    },
    'zip' : {
      template : 'templates/settings/export/zip.html',
      controller : ns.ZipExportController
    },
    'misc' : {
      template : 'templates/settings/export/misc.html',
      controller : ns.MiscExportController
    }
  };

  /**
   * Console-specific export tabs. Keys are console mode IDs.
   */
  var consoleTabs = {
    'chr' : {
      template : 'templates/settings/export/chr.html',
      controller : ns.ChrExportController,
      consoles : ['nes']  // Only available in NES mode
    }
  };

  /**
   * Gets the combined tabs for the current console mode.
   * @return {Object} Tab configuration object
   */
  function getTabsForCurrentMode() {
    var allTabs = Object.assign({}, baseTabs);
    var activeMode = pskl.app.consoleRegistry &&
                     pskl.app.consoleRegistry.getActive();
    var activeModeId = activeMode ? activeMode.id : 'default';

    // Add console-specific tabs
    Object.keys(consoleTabs).forEach(function (tabId) {
      var tabConfig = consoleTabs[tabId];
      if (tabConfig.consoles.indexOf(activeModeId) !== -1) {
        allTabs[tabId] = {
          template: tabConfig.template,
          controller: tabConfig.controller
        };
      }
    });

    return allTabs;
  }

  /**
   * Checks if a tab is available in the current console mode.
   * @param {string} tabId - Tab ID to check
   * @return {boolean}
   */
  function isTabAvailable(tabId) {
    // Base tabs are always available
    if (baseTabs[tabId]) {
      return true;
    }

    // Check console-specific tabs
    var tabConfig = consoleTabs[tabId];
    if (!tabConfig) {
      return false;
    }

    var activeMode = pskl.app.consoleRegistry &&
                     pskl.app.consoleRegistry.getActive();
    var activeModeId = activeMode ? activeMode.id : 'default';

    return tabConfig.consoles.indexOf(activeModeId) !== -1;
  }

  ns.ExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.tabsWidget = new pskl.widgets.Tabs(
      getTabsForCurrentMode(), this, pskl.UserSettings.EXPORT_TAB);
    this.onSizeInputChange_ = this.onSizeInputChange_.bind(this);
  };

  pskl.utils.inherit(ns.ExportController, pskl.controller.settings.AbstractSettingController);

  ns.ExportController.prototype.init = function () {
    // Initialize zoom controls
    this.scaleInput = document.querySelector('.export-scale .scale-input');
    this.addEventListener(this.scaleInput, 'change', this.onScaleChange_);
    this.addEventListener(this.scaleInput, 'input', this.onScaleChange_);

    this.widthInput = document.querySelector('.export-resize .resize-width');
    this.heightInput = document.querySelector('.export-resize .resize-height');
    var scale = pskl.UserSettings.get(pskl.UserSettings.EXPORT_SCALE);
    this.sizeInputWidget = new pskl.widgets.SizeInput({
      widthInput : this.widthInput,
      heightInput : this.heightInput,
      initWidth : this.piskelController.getWidth() * scale,
      initHeight : this.piskelController.getHeight() * scale,
      onChange : this.onSizeInputChange_
    });

    this.onSizeInputChange_();

    // Initialize tabs and panel
    var container = document.querySelector('.settings-section-export');
    this.tabsWidget.init(container);

    // Validate current tab is available for active console mode
    this.validateCurrentTab_();

    // Listen for console mode changes
    $.subscribe(Events.CONSOLE_MODE_CHANGED,
      this.onConsoleModeChanged_.bind(this));
    // Legacy: also listen for NES_MODE_CHANGED for backward compatibility
    $.subscribe(Events.NES_MODE_CHANGED, this.onNesModeChanged_.bind(this));
  };

  ns.ExportController.prototype.destroy = function () {
    $.unsubscribe(Events.CONSOLE_MODE_CHANGED, this.onConsoleModeChanged_);
    $.unsubscribe(Events.NES_MODE_CHANGED, this.onNesModeChanged_);
    this.sizeInputWidget.destroy();
    this.tabsWidget.destroy();
    this.superclass.destroy.call(this);
  };

  /**
   * Validates current tab is available, falls back to default if not.
   * @private
   */
  ns.ExportController.prototype.validateCurrentTab_ = function () {
    var currentTab = this.tabsWidget.currentTab;
    if (currentTab && !isTabAvailable(currentTab)) {
      this.tabsWidget.selectTab('gif');
    }
  };

  ns.ExportController.prototype.onScaleChange_ = function () {
    var value = parseFloat(this.scaleInput.value);
    if (!isNaN(value)) {
      if (Math.round(this.getExportZoom()) != value) {
        this.sizeInputWidget.setWidth(this.piskelController.getWidth() * value);
      }
      pskl.UserSettings.set(pskl.UserSettings.EXPORT_SCALE, value);
    }
  };

  ns.ExportController.prototype.updateScaleText_ = function (scale) {
    scale = scale.toFixed(1);
    var scaleText = document.querySelector('.export-scale .scale-text');
    scaleText.innerHTML = scale + 'x';
  };

  ns.ExportController.prototype.onSizeInputChange_ = function () {
    var zoom = this.getExportZoom();
    if (isNaN(zoom)) {
      return;
    }

    this.updateScaleText_(zoom);
    $.publish(Events.EXPORT_SCALE_CHANGED);

    this.scaleInput.value = Math.round(zoom);
    if (zoom >= 1 && zoom <= 32) {
      this.onScaleChange_();
    }
  };

  ns.ExportController.prototype.getExportZoom = function () {
    return parseInt(this.widthInput.value, 10) / this.piskelController.getWidth();
  };

  /**
   * Handles console mode changes. Updates available tabs and validates
   * current selection.
   * @param {Event} evt - The event object
   * @param {Object} data - {previous: ConsoleMode, current: ConsoleMode}
   * @private
   */
  ns.ExportController.prototype.onConsoleModeChanged_ = function (evt, data) {
    // Update the tabs widget with new available tabs
    this.tabsWidget.tabs = getTabsForCurrentMode();

    // Validate current tab is still available
    this.validateCurrentTab_();
  };

  /**
   * Handles legacy NES mode toggle for backward compatibility.
   * @param {Event} evt - The event object
   * @param {boolean} enabled - Whether NES mode is now enabled
   * @private
   */
  ns.ExportController.prototype.onNesModeChanged_ = function (evt, enabled) {
    // This is now handled by onConsoleModeChanged_, but we keep this
    // for any legacy code that might still fire NES_MODE_CHANGED
    this.validateCurrentTab_();
  };
})();
